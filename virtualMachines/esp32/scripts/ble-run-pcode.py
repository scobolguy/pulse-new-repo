import argparse
import asyncio
import base64
import json
from pathlib import Path

from bleak import BleakClient, BleakScanner
from pulse_stream import (
    BinaryFrameDecoder,
    CompletedStream,
    StreamAssembler,
    StreamFrame,
    StreamProtocolError,
    encode_ack,
)


SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"


async def find_device(name: str, timeout: float):
    device = await BleakScanner.find_device_by_filter(
        lambda candidate, advertisement: (
            (candidate.name or advertisement.local_name) == name
            and SERVICE_UUID in advertisement.service_uuids
        ),
        timeout=timeout,
    )
    if not device:
        raise RuntimeError(f"BLE control plane {name!r} was not found")
    return device


async def write_command(client: BleakClient, command: str) -> None:
    characteristic = client.services.get_characteristic(RX_UUID)
    if not characteristic:
        raise RuntimeError("BLE control-plane RX characteristic is unavailable")
    payload = f"{command}\n".encode()
    chunk_size = max(20, characteristic.max_write_without_response_size)
    for offset in range(0, len(payload), chunk_size):
        await client.write_gatt_char(
            characteristic,
            payload[offset : offset + chunk_size],
            response=False,
        )
        await asyncio.sleep(0.015)


async def send_command(client: BleakClient, responses: asyncio.Queue[str], command: str, timeout: float) -> str:
    await write_command(client, command)
    response = await asyncio.wait_for(responses.get(), timeout=timeout)
    if not isinstance(response, str):
        raise RuntimeError("received binary stream data while awaiting command response")
    return response


async def acknowledge_frame(client: BleakClient, frame: StreamFrame) -> None:
    characteristic = client.services.get_characteristic(RX_UUID)
    if not characteristic:
        raise RuntimeError("BLE control-plane RX characteristic is unavailable")
    await client.write_gatt_char(
        characteristic,
        encode_ack(frame.stream_id, frame.sequence),
        response=True,
    )


async def upload(client: BleakClient, responses: asyncio.Queue[str], local_path: Path, remote_path: str, timeout: float) -> None:
    encoded = base64.b64encode(local_path.read_bytes()).decode()
    payload = json.dumps({"path": remote_path, "data": encoded}, separators=(",", ":"))
    response = await send_command(client, responses, f"FILE_PUT {payload}", timeout)
    print(response)
    if '"ok":true' not in response:
        raise RuntimeError(f"upload failed for {local_path}")


async def run(args: argparse.Namespace) -> None:
    device = await find_device(args.device, args.timeout)
    responses: asyncio.Queue[str | StreamFrame] = asyncio.Queue()
    decoder = BinaryFrameDecoder(max_payload_bytes=4096)
    assembler = StreamAssembler(
        max_message_bytes=args.max_output_bytes,
        timeout_seconds=args.timeout,
    )

    def on_notification(_, data: bytearray) -> None:
        try:
            frames, lines = decoder.feed(bytes(data))
            for frame in frames:
                responses.put_nowait(frame)
            for line in lines:
                responses.put_nowait(line)
        except StreamProtocolError as error:
            print(f"stream frame rejected: {error}")

    async with BleakClient(device, timeout=args.timeout) as client:
        await client.start_notify(TX_UUID, on_notification)
        await upload(client, responses, args.pcode, "/ble/program.pcode", args.timeout)
        await upload(client, responses, args.program_map, "/ble/program.map.json", args.timeout)
        request = json.dumps(
            {
                "file": "/ble/program.pcode",
                "programMap": "/ble/program.map.json",
                "inputQueue": args.input_queue,
                "message": args.message,
                "max": 65536,
            },
            separators=(",", ":"),
        )
        await write_command(client, f"PCODE_RUN {request}")
        completed_stream: CompletedStream | None = None
        while True:
            response = await asyncio.wait_for(responses.get(), timeout=args.timeout)
            if isinstance(response, StreamFrame):
                completed = assembler.feed(response)
                await acknowledge_frame(client, response)
                if completed is not None:
                    completed_stream = completed
                continue
            if not isinstance(response, str):
                raise RuntimeError("unexpected BLE response type")
            print(response)
            if response.startswith("[BLE-CP] run "):
                break
        await client.stop_notify(TX_UUID)

        prefix = "[BLE-CP] run "
        if not response.startswith(prefix):
            raise RuntimeError("unexpected execution response")
        result = json.loads(response[len(prefix) :])
        if "statusCode" in result and result["statusCode"] != 200:
            raise RuntimeError(result.get("error", "execution failed"))
        execution = result.get("result", result)
        if isinstance(result.get("body"), str):
            execution = json.loads(result["body"])
        if not execution.get("ok", False):
            raise RuntimeError(execution.get("error", "execution failed"))
        if completed_stream is None:
            raise RuntimeError("execution completed without a complete stdout stream")
        print(
            completed_stream.payload.decode("utf-8", errors="strict"),
            end="",
        )
        for line in execution.get("stdout", []):
            print(line)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload and run signed pcode on an ESP32 over BLE")
    parser.add_argument("--pcode", type=Path, required=True)
    parser.add_argument("--program-map", type=Path, required=True)
    parser.add_argument("--device", default="ESP32-VM-6C5C-ble")
    parser.add_argument("--input-queue", default="ble.run")
    parser.add_argument("--message", default="")
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--max-output-bytes", type=int, default=1024 * 1024)
    return parser.parse_args()


if __name__ == "__main__":
    try:
        asyncio.run(run(parse_args()))
    except (RuntimeError, TimeoutError, ValueError, OSError) as error:
        raise SystemExit(str(error)) from error
