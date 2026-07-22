# ESP32/ESP8266 Device Hardware Configuration

This document maps devices to their hardware types and pin configurations for control commands.

## Device Types

### ESP32
- **LED Pin (GPIO)**: 2 (default D4 on most DevKit boards)
- **Alternative LED Pins**: 5, 12, 13, 14, 15
- **Control Method**: GPIO output (LOW = off, HIGH = on)
- **Hardware**: Microcontroller, 32-bit dual-core
- **Voltage**: 3.3V

### ESP8266  
- **LED Pin (GPIO)**: 2 (D4 on WeMos D1 Mini, GPIO16 for D0)
- **Alternative LED Pins**: 4, 5, 12, 13, 14, 15
- **Control Method**: GPIO output (LOW = off, HIGH = on)
- **Hardware**: Microcontroller, 32-bit single-core
- **Voltage**: 3.3V

### ESP32-CAM
- **LED Pin (GPIO)**: 4 (Flash LED pin)
- **Alternative Pins**: 12, 13, 14, 15
- **Control Method**: GPIO output (LOW = off, HIGH = on)
- **Hardware**: Microcontroller with camera, 32-bit dual-core
- **Voltage**: 3.3V
- **Notes**: Often has built-in flash LED on GPIO4

## Network Devices

### child1
- **Type**: ESP32-CAM
- **IP**: 192.168.2.157
- **LED Pin**: 4 (Flash LED)
- **Parent**: Neptune

### child2
- **Type**: ESP8266
- **IP**: 192.168.2.59
- **LED Pin**: 2 (GPIO2/D4)
- **Parent**: Neptune

### child3
- **Type**: ESP32
- **IP**: 192.168.2.58
- **LED Pin**: 2 (GPIO2)
- **Parent**: Neptune

## Command Examples

### Turn on LED on child1 (ESP32-CAM)
```
POST /devices/ledpin/action?action=on
```

### Turn off LED on child2 (ESP8266)
```
POST /devices/ledpin/action?action=off
```

### Turn on LED on child3 (ESP32)
```
POST /devices/ledpin/action?action=on
```

## GPIO Commands

All device control on ESP32/ESP8266 uses this endpoint:
- **Endpoint**: `/devices/ledpin/action?action=on|off`
- **Method**: POST
- **Parameters**:
  - `action=on` - Turn LED ON (HIGH)
  - `action=off` - Turn LED OFF (LOW)

## Device Lookup Flow

1. Parse device name from query (e.g., "child1", "neptune.child1")
2. Look up device in network registry
3. Get device type from registry
4. Look up LED pin for that type in this document
5. Construct LED command with correct action
6. Send command to device IP: `/devices/ledpin/action?action=on|off`
7. Return response with command status

## Future Extensions

- Support for multiple LED pins (RGB LED)
- PWM brightness control (0-255)
- Button/sensor pin configuration
- Relay control
- Motor control
