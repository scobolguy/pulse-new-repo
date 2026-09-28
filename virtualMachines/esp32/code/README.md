# Code

Application and firmware source will live under this directory:

- `aggregator/` for the Node.js control plane, frontend, compiler tooling, and deployment configuration.
- `firmware/` for board-specific ESP32 application code and PlatformIO configuration.

Reusable PMachine runtimes do not belong here; they will live in `../pmachines/` and be consumed through stable package or library interfaces.