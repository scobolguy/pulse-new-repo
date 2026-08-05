import struct
import unittest
import zlib

from pulse_stream import (
    BinaryFrameDecoder,
    StreamAssembler,
    StreamProtocolError,
    TYPE_BEGIN,
    TYPE_DATA,
    TYPE_END,
    encode_frame,
)


class StreamProtocolTests(unittest.TestCase):
    def test_decodes_binary_across_transport_boundaries(self) -> None:
        binary = b"a\r\n\x00\xffpayload"
        encoded = encode_frame(TYPE_DATA, 7, 1, binary)
        decoder = BinaryFrameDecoder()
        frames = []
        for offset in range(0, len(encoded), 3):
            decoded, lines = decoder.feed(encoded[offset : offset + 3])
            frames.extend(decoded)
            self.assertEqual(lines, [])
        self.assertEqual(frames[0].payload, binary)

    def test_reassembles_out_of_order_binary_chunks(self) -> None:
        decoder = BinaryFrameDecoder()
        assembler = StreamAssembler()
        payload = b"first\r\n\x00\xffsecond"
        wire = b"".join([
            encode_frame(TYPE_BEGIN, 8, 0, b"application/octet-stream"),
            encode_frame(TYPE_DATA, 8, 2, payload[8:]),
            encode_frame(TYPE_DATA, 8, 1, payload[:8]),
            encode_frame(TYPE_END, 8, 3, struct.pack("<II", len(payload), zlib.crc32(payload))),
        ])
        frames, _ = decoder.feed(wire)
        completed = None
        for frame in frames:
            completed = assembler.feed(frame) or completed
        self.assertEqual(completed.payload, payload)
        self.assertEqual(completed.content_type, "application/octet-stream")

    def test_accepts_identical_retry(self) -> None:
        decoder = BinaryFrameDecoder()
        frames, _ = decoder.feed(
            encode_frame(TYPE_BEGIN, 9, 0, b"text/plain")
            + encode_frame(TYPE_DATA, 9, 1, b"same")
        )
        assembler = StreamAssembler()
        assembler.feed(frames[0])
        assembler.feed(frames[0])
        assembler.feed(frames[1])
        self.assertIsNone(assembler.feed(frames[1]))

    def test_rejects_corrupt_frame(self) -> None:
        encoded = bytearray(encode_frame(TYPE_DATA, 10, 1, b"data"))
        encoded[-1] ^= 0x01
        with self.assertRaisesRegex(StreamProtocolError, "checksum mismatch"):
            BinaryFrameDecoder().feed(encoded)

    def test_recovers_retry_after_dropped_transport_bytes(self) -> None:
        encoded = encode_frame(TYPE_DATA, 11, 4, b"binary\x00\xffpayload")
        decoder = BinaryFrameDecoder()
        decoder.feed(encoded[:-5])
        with self.assertRaisesRegex(StreamProtocolError, "checksum mismatch"):
            decoder.feed(encoded)
        frames, lines = decoder.feed(b"")
        self.assertEqual(lines, [])
        self.assertEqual(frames[0].payload, b"binary\x00\xffpayload")


if __name__ == "__main__":
    unittest.main()