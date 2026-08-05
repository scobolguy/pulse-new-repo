import argparse
import asyncio
import json

from bleak import BleakClient, BleakScanner


SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"


def build_command(args: argparse.Namespace) -> str:
    if args.action != "PROVISION":
        return args.action

    if not args.ssid:
        raise ValueError("--ssid is required for PROVISION")

    payload = {
        "ssid": args.ssid,
        "password": args.password,
        "connect": not args.no_connect,
        "reboot": args.reboot,
    }
    if args.node_name:
        payload["nodeName"] = args.node_name
    return f"PROVISION {json.dumps(payload, separators=(',', ':'))}"


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


async def run(args: argparse.Namespace) -> None:
    device = await find_device(args.device, args.timeout)
    command = build_command(args)
    response_ready = asyncio.Event()
    response = bytearray()

    def on_notification(_, data: bytearray) -> None:
        response.extend(data)
        if b"\n" in response:
            response_ready.set()

    async with BleakClient(device, timeout=args.timeout) as client:
        await client.start_notify(TX_UUID, on_notification)
        await client.write_gatt_char(
            RX_UUID,
            f"{command}\n".encode(),
            response=False,
        )
        await asyncio.wait_for(response_ready.wait(), timeout=args.timeout)
        await client.stop_notify(TX_UUID)

    print(response.partition(b"\n")[0].decode(errors="replace"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ESP32 BLE control-plane client")
    parser.add_argument("action", choices=("PING", "STATUS", "PROVISION"))
    parser.add_argument("--device", default="ESP32-VM-6C5C-ble")
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--ssid")
    parser.add_argument("--password", default="")
    parser.add_argument("--node-name")
    parser.add_argument("--no-connect", action="store_true")
    parser.add_argument("--reboot", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    try:
        asyncio.run(run(parse_args()))
    except (RuntimeError, TimeoutError, ValueError) as error:
        raise SystemExit(str(error)) from error