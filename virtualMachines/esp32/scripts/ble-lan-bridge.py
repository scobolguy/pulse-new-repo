import argparse
import asyncio
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from bleak import BleakClient, BleakScanner


SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
MAX_URL_BYTES = 2048
MAX_BODY_BYTES = 65536


@dataclass
class RpcRequest:
    request_id: int
    method: str
    url_length: int
    body_length: int


class FrameParser:
    def __init__(self) -> None:
        self.buffer = bytearray()
        self.pending: RpcRequest | None = None

    def feed(self, data: bytes) -> list[tuple[RpcRequest, bytes, bytes]]:
        self.buffer.extend(data)
        frames = []
        while True:
            if self.pending is None:
                newline = self.buffer.find(b"\n")
                if newline < 0:
                    break
                header = bytes(self.buffer[:newline]).decode("ascii", errors="strict")
                del self.buffer[: newline + 1]
                if not header.startswith("REQ "):
                    continue
                parts = header.split()
                if len(parts) != 5:
                    raise ValueError(f"invalid request header: {header!r}")
                request = RpcRequest(
                    request_id=int(parts[1]),
                    method=parts[2],
                    url_length=int(parts[3]),
                    body_length=int(parts[4]),
                )
                if request.method != "POST":
                    raise ValueError(f"unsupported method: {request.method}")
                if request.url_length > MAX_URL_BYTES or request.body_length > MAX_BODY_BYTES:
                    raise ValueError("request exceeds bridge limits")
                self.pending = request

            required = self.pending.url_length + self.pending.body_length
            if len(self.buffer) < required:
                break
            url = bytes(self.buffer[: self.pending.url_length])
            body = bytes(self.buffer[self.pending.url_length : required])
            del self.buffer[:required]
            frames.append((self.pending, url, body))
            self.pending = None
        return frames


def execute_post(
    url: str,
    body: bytes,
    allowed_hosts: set[str],
    host_map: dict[str, str],
    timeout: float,
) -> tuple[int, bytes]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return 400, b'invalid bridge URL'
    if parsed.hostname.lower() not in allowed_hosts:
        return 403, f"bridge host not allowed: {parsed.hostname}".encode()

    mapped_host = host_map.get(parsed.hostname.lower())
    if mapped_host:
        port = f":{parsed.port}" if parsed.port else ""
        url = parsed._replace(netloc=f"{mapped_host}{port}").geturl()

    request = Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, response.read(MAX_BODY_BYTES + 1)
    except HTTPError as error:
        return error.code, error.read(MAX_BODY_BYTES + 1)
    except (TimeoutError, URLError, OSError) as error:
        return 502, str(error).encode()


async def write_frame(client: BleakClient, header: bytes, body: bytes) -> None:
    characteristic = client.services.get_characteristic(RX_UUID)
    if not characteristic:
        raise RuntimeError("BLE control-plane RX characteristic is unavailable")
    chunk_size = max(20, characteristic.max_write_without_response_size)
    payload = header + body
    for offset in range(0, len(payload), chunk_size):
        await client.write_gatt_char(
            characteristic,
            payload[offset : offset + chunk_size],
            response=False,
        )


async def bridge_session(args: argparse.Namespace, device) -> None:
    parser = FrameParser()
    requests: asyncio.Queue[tuple[RpcRequest, bytes, bytes]] = asyncio.Queue()
    allowed_hosts = {host.lower() for host in args.allow_host}
    host_map = dict(mapping.split("=", 1) for mapping in args.map_host)

    def on_notification(_, data: bytearray) -> None:
        try:
            for frame in parser.feed(bytes(data)):
                requests.put_nowait(frame)
        except (UnicodeDecodeError, ValueError) as error:
            print(f"protocol error: {error}")

    async with BleakClient(device, timeout=args.connect_timeout) as client:
        await client.start_notify(TX_UUID, on_notification)
        print(f"BLE LAN bridge connected to {args.device}")
        while client.is_connected:
            request, url_bytes, body = await requests.get()
            url = url_bytes.decode("utf-8", errors="strict")
            print(f"RPC {request.request_id}: {request.method} {url} ({len(body)} bytes)")
            if args.verbose:
                print(f"RPC {request.request_id} request: {body.decode(errors='replace')}")
            status, response_body = await asyncio.to_thread(
                execute_post,
                url,
                body,
                allowed_hosts,
                host_map,
                args.http_timeout,
            )
            if len(response_body) > MAX_BODY_BYTES:
                status = 502
                response_body = b"bridge response exceeds 65536 bytes"
            header = f"RSP {request.request_id} {status} {len(response_body)}\n".encode()
            await write_frame(client, header, response_body)
            print(f"RPC {request.request_id}: {status} ({len(response_body)} bytes)")
            if args.verbose:
                print(f"RPC {request.request_id} response: {response_body.decode(errors='replace')}")


async def run(args: argparse.Namespace) -> None:
    while True:
        try:
            device = await BleakScanner.find_device_by_filter(
                lambda candidate, advertisement: (
                    (candidate.name or advertisement.local_name) == args.device
                    and SERVICE_UUID in advertisement.service_uuids
                ),
                timeout=args.scan_timeout,
            )
            if not device:
                print(f"waiting for {args.device}")
            else:
                await bridge_session(args, device)
        except (asyncio.TimeoutError, RuntimeError, OSError) as error:
            print(f"bridge disconnected: {error}")
        await asyncio.sleep(args.reconnect_delay)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bridge ESP32 BLE HTTP RPC onto the T490 LAN")
    parser.add_argument("--device", default="ESP32-VM-6C5C-ble")
    parser.add_argument("--allow-host", action="append", required=True)
    parser.add_argument("--map-host", action="append", default=[])
    parser.add_argument("--scan-timeout", type=float, default=10.0)
    parser.add_argument("--connect-timeout", type=float, default=20.0)
    parser.add_argument("--http-timeout", type=float, default=10.0)
    parser.add_argument("--reconnect-delay", type=float, default=2.0)
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    try:
        asyncio.run(run(parse_args()))
    except KeyboardInterrupt:
        pass
