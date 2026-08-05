from __future__ import annotations

import struct
import time
import zlib
from dataclasses import dataclass, field


MAGIC = b"PLS1"
HEADER = struct.Struct("<4sBBHIII")
HEADER_BYTES = HEADER.size
TYPE_BEGIN = 1
TYPE_DATA = 2
TYPE_END = 3
TYPE_ABORT = 4
TYPE_ACK = 5


class StreamProtocolError(ValueError):
    pass


@dataclass(frozen=True)
class StreamFrame:
    frame_type: int
    stream_id: int
    sequence: int
    payload: bytes
    checksum: int


@dataclass(frozen=True)
class CompletedStream:
    stream_id: int
    content_type: str
    payload: bytes
    frame_count: int
    crc32: int


@dataclass
class _PendingStream:
    content_type: str
    created_at: float
    chunks: dict[int, bytes] = field(default_factory=dict)
    received_bytes: int = 0


def encode_frame(frame_type: int, stream_id: int, sequence: int, payload: bytes = b"") -> bytes:
    return HEADER.pack(
        MAGIC,
        frame_type,
        0,
        len(payload),
        stream_id,
        sequence,
        zlib.crc32(payload),
    ) + payload


def encode_ack(stream_id: int, sequence: int) -> bytes:
    return encode_frame(TYPE_ACK, stream_id, sequence)


class BinaryFrameDecoder:
    def __init__(self, *, max_payload_bytes: int = 4096) -> None:
        self.max_payload_bytes = max_payload_bytes
        self.buffer = bytearray()

    def feed(self, data: bytes) -> tuple[list[StreamFrame], list[str]]:
        self.buffer.extend(data)
        frames: list[StreamFrame] = []
        lines: list[str] = []
        while self.buffer:
            if self.buffer.startswith(MAGIC):
                if len(self.buffer) < HEADER_BYTES:
                    break
                magic, frame_type, _, length, stream_id, sequence, checksum = HEADER.unpack_from(self.buffer)
                if magic != MAGIC or length > self.max_payload_bytes:
                    raise StreamProtocolError("invalid binary stream header")
                frame_bytes = HEADER_BYTES + length
                if len(self.buffer) < frame_bytes:
                    break
                payload = bytes(self.buffer[HEADER_BYTES:frame_bytes])
                if zlib.crc32(payload) != checksum:
                    retry_offset = self.buffer.find(MAGIC, 1, frame_bytes)
                    del self.buffer[: retry_offset if retry_offset >= 0 else frame_bytes]
                    raise StreamProtocolError(
                        f"stream {stream_id} frame {sequence} checksum mismatch"
                    )
                del self.buffer[:frame_bytes]
                frames.append(StreamFrame(frame_type, stream_id, sequence, payload, checksum))
                continue

            newline = self.buffer.find(b"\n")
            magic = self.buffer.find(MAGIC)
            if magic > 0 and (newline < 0 or magic < newline):
                del self.buffer[:magic]
                continue
            if newline < 0:
                break
            line = bytes(self.buffer[:newline])
            del self.buffer[: newline + 1]
            if line.endswith(b"\r"):
                line = line[:-1]
            lines.append(line.decode("utf-8", errors="replace"))
        return frames, lines


class StreamAssembler:
    def __init__(
        self,
        *,
        max_message_bytes: int = 1024 * 1024,
        max_frames: int = 4096,
        max_streams: int = 8,
        timeout_seconds: float = 60.0,
    ) -> None:
        self.max_message_bytes = max_message_bytes
        self.max_frames = max_frames
        self.max_streams = max_streams
        self.timeout_seconds = timeout_seconds
        self._pending: dict[int, _PendingStream] = {}
        self._completed: dict[int, tuple[int, CompletedStream]] = {}

    def expire(self, now: float | None = None) -> list[int]:
        current = time.monotonic() if now is None else now
        expired = [
            stream_id
            for stream_id, stream in self._pending.items()
            if current - stream.created_at > self.timeout_seconds
        ]
        for stream_id in expired:
            del self._pending[stream_id]
        return expired

    def feed(self, frame: StreamFrame) -> CompletedStream | None:
        self.expire()
        if frame.frame_type == TYPE_BEGIN:
            return self._begin(frame)
        if frame.frame_type == TYPE_DATA:
            return self._data(frame)
        if frame.frame_type == TYPE_END:
            return self._end(frame)
        if frame.frame_type == TYPE_ABORT:
            self._pending.pop(frame.stream_id, None)
            raise StreamProtocolError(f"stream {frame.stream_id} was aborted by producer")
        raise StreamProtocolError(f"unsupported stream frame type: {frame.frame_type}")

    def _begin(self, frame: StreamFrame) -> None:
        if frame.sequence != 0:
            raise StreamProtocolError("begin frame sequence must be zero")
        content_type = frame.payload.decode("utf-8", errors="strict") or "application/octet-stream"
        existing = self._pending.get(frame.stream_id)
        if existing is not None:
            if existing.content_type != content_type:
                raise StreamProtocolError(f"stream {frame.stream_id} begin changed on retry")
            return None
        if len(self._pending) >= self.max_streams:
            raise StreamProtocolError("too many concurrent streams")
        self._pending[frame.stream_id] = _PendingStream(content_type, time.monotonic())
        return None

    def _data(self, frame: StreamFrame) -> None:
        stream = self._require_stream(frame.stream_id)
        if frame.sequence <= 0 or frame.sequence > self.max_frames:
            raise StreamProtocolError("data frame sequence is outside configured limits")
        existing = stream.chunks.get(frame.sequence)
        if existing is not None:
            if existing != frame.payload:
                raise StreamProtocolError(f"stream {frame.stream_id} frame changed on retry")
            return None
        if stream.received_bytes + len(frame.payload) > self.max_message_bytes:
            del self._pending[frame.stream_id]
            raise StreamProtocolError(f"stream {frame.stream_id} exceeds configured byte limit")
        stream.chunks[frame.sequence] = frame.payload
        stream.received_bytes += len(frame.payload)
        return None

    def _end(self, frame: StreamFrame) -> CompletedStream:
        if len(frame.payload) != 8:
            raise StreamProtocolError("end frame metadata must be eight bytes")
        total_bytes, total_crc32 = struct.unpack("<II", frame.payload)
        prior = self._completed.get(frame.stream_id)
        if prior is not None:
            prior_sequence, completed = prior
            if prior_sequence == frame.sequence and len(completed.payload) == total_bytes and completed.crc32 == total_crc32:
                return completed
            raise StreamProtocolError(f"stream {frame.stream_id} end changed on retry")

        stream = self._require_stream(frame.stream_id)
        expected = range(1, frame.sequence)
        missing = [sequence for sequence in expected if sequence not in stream.chunks]
        if missing:
            raise StreamProtocolError(f"stream {frame.stream_id} is missing frame {missing[0]}")
        payload = b"".join(stream.chunks[sequence] for sequence in expected)
        if len(payload) != total_bytes:
            raise StreamProtocolError(f"stream {frame.stream_id} total length mismatch")
        if zlib.crc32(payload) != total_crc32:
            raise StreamProtocolError(f"stream {frame.stream_id} total checksum mismatch")

        completed = CompletedStream(
            frame.stream_id,
            stream.content_type,
            payload,
            frame.sequence - 1,
            total_crc32,
        )
        del self._pending[frame.stream_id]
        self._completed[frame.stream_id] = (frame.sequence, completed)
        if len(self._completed) > self.max_streams:
            del self._completed[next(iter(self._completed))]
        return completed

    def _require_stream(self, stream_id: int) -> _PendingStream:
        stream = self._pending.get(stream_id)
        if stream is None:
            raise StreamProtocolError(f"stream {stream_id} has not begun or has expired")
        return stream