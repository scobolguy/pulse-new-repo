import re
from collections import defaultdict

sizes = defaultdict(int)
obj_files = set()

with open(".pio/build/esp32dev/firmware.map", "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        match = re.search(r"\.pio\\build\\esp32dev\\src\\([A-Za-z0-9_\/]+\.cpp\.o)", line)
        if match:
            obj = match.group(1)
            obj_files.add(obj)
            size_match = re.search(r"\s+0x[0-9a-fA-F]+\s+0x([0-9a-fA-F]+)\s+.*" + re.escape(obj), line)
            if size_match:
                size = int(size_match.group(1), 16)
                sizes[obj] += size

print("Detected object files and code sizes (bytes):")
for obj in sorted(obj_files):
    print(f"{obj:40} {sizes[obj]}")
