import argparse
import asyncio
import json

from kasa import Discover


def device_payload(host, device):
    return {
        "host": host,
        "alias": device.alias,
        "model": device.model,
        "deviceType": str(device.device_type).split(".")[-1].lower(),
        "mac": device.mac,
        "isOn": device.is_on,
        "features": sorted(device.features.keys()),
    }


async def discover(args):
    devices = await Discover.discover(
        target=args.target,
        interface=args.interface,
        discovery_timeout=args.timeout,
        discovery_packets=args.packets,
    )
    return [device_payload(host, device) for host, device in devices.items()]


async def invoke(args):
    device = await Discover.discover_single(args.host, discovery_timeout=args.timeout)
    await device.update()
    if args.action == "on":
        await device.turn_on()
    elif args.action == "off":
        await device.turn_off()
    elif args.action == "toggle":
        if device.is_on:
            await device.turn_off()
        else:
            await device.turn_on()
    elif args.action != "status":
        raise ValueError(f"Unsupported action: {args.action}")
    await device.update()
    return device_payload(args.host, device)


async def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover_parser = subparsers.add_parser("discover")
    discover_parser.add_argument("--target", default="255.255.255.255")
    discover_parser.add_argument("--interface")
    discover_parser.add_argument("--timeout", type=int, default=8)
    discover_parser.add_argument("--packets", type=int, default=5)

    action_parser = subparsers.add_parser("action")
    action_parser.add_argument("--host", required=True)
    action_parser.add_argument("--action", choices=("status", "on", "off", "toggle"), required=True)
    action_parser.add_argument("--timeout", type=int, default=8)

    args = parser.parse_args()
    result = await (discover(args) if args.command == "discover" else invoke(args))
    print(json.dumps(result, separators=(",", ":"), default=str))


if __name__ == "__main__":
    asyncio.run(main())