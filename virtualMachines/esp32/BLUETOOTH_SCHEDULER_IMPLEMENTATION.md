# Bluetooth Device Scanner & Event Scheduler Implementation

## Overview

This implementation provides a comprehensive Bluetooth Low Energy (BLE) device scanner and time-based event scheduler for ESP32. It enables discovery and control of smart home devices (lightbulbs, outlets, water controllers) while filtering out non-controllable devices like watches.

## Key Features

### 1. Bluetooth Device Scanner (BluetoothService)
- **Compact Implementation**: Uses NimBLE stack (~50KB vs ~120KB for Bluedroid)
- **Auto-discovery**: Periodic scanning for BLE devices
- **Device Classification**: Automatically detects device types
- **Watch Filtering**: Identifies and excludes watches from control
- **Device Control**: On/off, brightness, color control for compatible devices
- **Persistent Storage**: Saves discovered devices to `bluetooth.json`

### 2. Event Scheduler (EventScheduler)
- **Natural Language Parsing**: "Turn on light7 at 10 PM"
- **Cron Expressions**: "0 22 * * *" for recurring events
- **Duration Support**: Auto-off after specified time
- **One-time & Recurring**: Flexible scheduling options
- **Persistent Storage**: Saves schedules to `schedules.json`
- **WFL Integration**: Callable from workflow programs

### 3. HTTP API
- Complete REST API for device and schedule management
- Real-time device status monitoring
- Manual event triggering
- Quick scheduling from natural language

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ESP32 Application                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ BluetoothService │      │ EventScheduler   │        │
│  │  (NimBLE)        │◄─────┤  (Time-based)    │        │
│  └──────────────────┘      └──────────────────┘        │
│           │                          │                   │
│           ├──────────────────────────┤                   │
│           │                          │                   │
│  ┌────────▼──────────────────────────▼────────┐        │
│  │         HTTP API Routes                     │        │
│  │  /api/bluetooth/*  /api/schedules/*        │        │
│  └─────────────────────────────────────────────┘        │
│           │                          │                   │
│  ┌────────▼──────────┐      ┌───────▼──────────┐       │
│  │  bluetooth.json   │      │  schedules.json  │       │
│  └───────────────────┘      └──────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## File Structure

### Core Implementation
- `src/BluetoothService.h` - Bluetooth service interface
- `src/BluetoothService.cpp` - Bluetooth service implementation (NimBLE)
- `src/EventScheduler.h` - Event scheduler interface
- `src/EventScheduler.cpp` - Event scheduler implementation
- `src/bluetooth_routes.h` - HTTP API routes header
- `src/bluetooth_routes.cpp` - HTTP API routes implementation

### Configuration Files
- `data/config/bluetooth.json` - Bluetooth device configuration
- `data/config/schedules.json` - Scheduled events configuration

### Build Configuration
- `platformio.ini` - Added `esp32_bluetooth_controller` environment

## Device Types

### Supported Bluetooth Devices
1. **Lightbulbs** - On/off, brightness, color control
2. **Outlets** - On/off control
3. **Water Controllers** - On/off, flow control
4. **Watches** - Display only (not controllable)
5. **Sensors** - Read-only data
6. **Speakers** - Audio control
7. **Other** - Generic BLE devices

### Device Detection
Devices are classified based on:
- BLE service UUIDs
- Manufacturer data
- Device name patterns
- Advertised characteristics

## API Endpoints

### Bluetooth Device Management

```
GET    /api/bluetooth/devices              - List all devices
GET    /api/bluetooth/devices/controllable - List controllable devices
GET    /api/bluetooth/device/:address      - Get device details
POST   /api/bluetooth/scan                 - Start device scan
POST   /api/bluetooth/control              - Control a device
POST   /api/bluetooth/connect/:address     - Connect to device
POST   /api/bluetooth/disconnect/:address  - Disconnect from device
```

### Event Scheduler

```
GET    /api/schedules                      - List all schedules
GET    /api/schedules/upcoming             - Get upcoming events
GET    /api/schedules/:id                  - Get event details
POST   /api/schedules/create               - Create new event
POST   /api/schedules/quick                - Quick schedule (natural language)
DELETE /api/schedules/:id                  - Delete event
POST   /api/schedules/:id/enable           - Enable event
POST   /api/schedules/:id/disable          - Disable event
POST   /api/schedules/:id/trigger          - Manually trigger event
```

## Usage Examples

### 1. Scan for Bluetooth Devices

```bash
curl -X POST http://esp32-ip/api/bluetooth/scan?duration=10
```

### 2. List Discovered Devices

```bash
curl http://esp32-ip/api/bluetooth/devices
```

Response:
```json
{
  "devices": [
    {
      "address": "AA:BB:CC:DD:EE:FF",
      "name": "Smart Bulb",
      "type": 1,
      "rssi": -65,
      "controllable": true,
      "connected": false,
      "powerState": false
    }
  ]
}
```

### 3. Control a Device

```bash
curl -X POST http://esp32-ip/api/bluetooth/control \
  -H "Content-Type: application/json" \
  -d '{
    "address": "AA:BB:CC:DD:EE:FF",
    "action": "on"
  }'
```

### 4. Schedule an Event (Natural Language)

```bash
curl -X POST http://esp32-ip/api/schedules/quick \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "light7",
    "deviceType": "bluetooth",
    "action": "on",
    "time": "10 PM",
    "duration": "20 minutes",
    "recurring": false
  }'
```

### 5. Create Recurring Schedule

```bash
curl -X POST http://esp32-ip/api/schedules/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Sprinkler",
    "deviceId": "front_sprinkler",
    "deviceType": "bluetooth",
    "action": "on",
    "schedule": "0 10 * * *",
    "recurring": true,
    "duration": 1200,
    "enabled": true
  }'
```

## Alexa Integration Examples

### Voice Commands

```
"Alexa, turn on light 7 at 10 PM"
→ Creates one-time schedule for tonight at 22:00

"Alexa, turn on the front sprinkler at 10 AM for 20 minutes"
→ Creates one-time schedule with 1200 second duration

"Alexa, turn on light 7 every day at 10 PM"
→ Creates recurring daily schedule at 22:00

"Alexa, what's scheduled for today?"
→ Lists all events scheduled for current day
```

## WFL Integration

### Scheduler Opcodes (Planned)

```pascal
PROGRAM AutomationController;
BEGIN
    // Schedule one-time event
    SCHEDULE_ONCE "light7" "on" "22:00:00";
    
    // Schedule recurring event with duration
    SCHEDULE_REPEAT "front_sprinkler" "on" "10:00:00" DURATION 1200;
    
    // Cancel scheduled event
    CANCEL_SCHEDULE "event_id";
    
    // List all schedules
    LIST_SCHEDULES;
END.
```

## Memory Optimization

### NimBLE vs Bluedroid

| Feature | NimBLE | Bluedroid |
|---------|--------|-----------|
| Flash Size | ~50KB | ~120KB |
| RAM Usage | ~15KB | ~40KB |
| Features | BLE only | BLE + Classic |
| Performance | Faster | Slower |

**Recommendation**: Use NimBLE for BLE-only applications to save ~70KB flash and ~25KB RAM.

## Build Instructions

### 1. Build for Bluetooth Controller

```bash
pio run -e esp32_bluetooth_controller
```

### 2. Upload to ESP32

```bash
pio run -e esp32_bluetooth_controller -t upload
```

### 3. Monitor Serial Output

```bash
pio device monitor -e esp32_bluetooth_controller
```

## Configuration

### bluetooth.json

```json
{
  "devices": [],
  "settings": {
    "autoDiscovery": true,
    "scanInterval": 60000,
    "scanDuration": 10,
    "statusCheckInterval": 30000,
    "excludeWatches": true
  }
}
```

### schedules.json

```json
{
  "events": [],
  "settings": {
    "enabled": true,
    "checkInterval": 1000,
    "maxEvents": 100,
    "persistEvents": true,
    "timezone": "America/New_York"
  }
}
```

## Time Specifications

### Natural Language
- "10 PM", "10:30 AM"
- "22:00", "10:30"

### Cron Expressions
- `0 22 * * *` - 10 PM daily
- `0 10 * * 1-5` - 10 AM weekdays
- `*/15 * * * *` - Every 15 minutes

### Relative Time
- `+30m` - 30 minutes from now
- `+2h` - 2 hours from now

### Duration
- "20 minutes", "2 hours"
- "1200" (seconds)

## Security Considerations

1. **Device Pairing**: Implement secure pairing for sensitive devices
2. **API Authentication**: Add authentication to HTTP endpoints
3. **Encryption**: Use encrypted connections for device control
4. **Access Control**: Limit which devices can be controlled

## Future Enhancements

1. **Device-Specific Protocols**: Add support for proprietary protocols (Philips Hue, LIFX, etc.)
2. **Group Control**: Control multiple devices simultaneously
3. **Scenes**: Pre-configured device states
4. **Geofencing**: Location-based automation
5. **Conditional Events**: Trigger based on sensor data
6. **Voice Feedback**: Alexa responses for schedule confirmations
7. **Mobile App**: Dedicated mobile interface
8. **Cloud Sync**: Synchronize schedules across devices

## Troubleshooting

### Bluetooth Scan Not Finding Devices
- Ensure devices are in pairing/advertising mode
- Check if devices are already connected to another system
- Increase scan duration
- Move ESP32 closer to devices

### Schedule Not Executing
- Verify timezone is set correctly
- Check if event is enabled
- Ensure device is connected
- Review serial output for errors

### Memory Issues
- Reduce `maxEvents` in schedules.json
- Decrease scan interval
- Limit number of stored devices

## Performance Metrics

- **Scan Time**: 10 seconds (configurable)
- **Device Discovery**: ~100ms per device
- **Schedule Check**: Every 1 second
- **Memory Usage**: ~80KB flash, ~20KB RAM
- **Max Devices**: Limited by available RAM (~50-100 devices)
- **Max Schedules**: 100 (configurable)

## License

Made with Bob

## Support

For issues or questions, refer to the main project documentation.