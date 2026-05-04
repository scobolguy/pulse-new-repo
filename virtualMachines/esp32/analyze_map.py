import re
from collections import defaultdict

# List your service object files here (add/remove as needed)
services = [
    "SensorService.cpp.o",
    "pmachine.cpp.o",
    "FederatedFileSystem.cpp.o",
    "DevicePin.cpp.o",
    "NodeConfig.cpp.o",
    "main.cpp.o"
]

sizes = defaultdict(int)

with open(".pio/build/esp32dev/firmware.map", "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        for service in services:
            if service in line:
                # Look for lines like: .text._func  0x00000000  0x123 .pio\build\esp32dev\src\Service.cpp.o
                match = re.search(r"\\s+0x[0-9a-fA-F]+\\s+0x([0-9a-fA-F]+)\\s+.*" + re.escape(service), line)
                if match:
                    size = int(match.group(1), 16)
                    sizes[service] += size

print("Service Code Size Summary (bytes):")
for service in services:
    print(f"{service:30} {sizes[service]}")
