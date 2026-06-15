# Phase 7 & 8 Implementation Plan

**Status:** Design Complete, Implementation In Progress  
**Date:** June 11, 2026

---

## Phase 7: Registry-Driven Configuration

### Overview
Replace ad-hoc JSON configuration with a schema-driven registry system that provides type safety, validation, and soft-driven behavior.

### Completed Deliverables

#### 1. JSON Schema (✅ Complete)
**File:** `config/device-config.schema.json` (329 lines)

**Features:**
- Complete JSON Schema Draft-07 specification
- Device identification and role
- Hardware configuration
- Sensor and actuator definitions
- Network settings (WiFi, MQTT, HTTP)
- Broker configuration
- Storage options (SD card, SPIFFS)
- Scheduler configuration
- Library management
- Logging configuration

#### 2. Example Configuration (✅ Complete)
**File:** `config/device-config.example.json` (117 lines)

**Demonstrates:**
- Backend node configuration
- Multiple sensors and actuators
- Network setup
- Broker queues
- SD card chunkstore
- Auto-loaded libraries
- Logging configuration

### Pending Implementation

#### 3. Device Registry Class
**File:** `src/device_registry.h` (to be created)

```cpp
class DeviceRegistry {
public:
    bool loadConfig(const std::string& configPath);
    bool validateConfig(const std::string& json);
    
    // Getters for configuration sections
    DeviceInfo getDeviceInfo();
    std::vector<SensorConfig> getSensors();
    std::vector<ActuatorConfig> getActuators();
    NetworkConfig getNetworkConfig();
    BrokerConfig getBrokerConfig();
    StorageConfig getStorageConfig();
    SchedulerConfig getSchedulerConfig();
    
    // Dynamic updates
    bool updateSensor(const std::string& id, const SensorConfig& config);
    bool updateActuator(const std::string& id, const ActuatorConfig& config);
    
private:
    JsonDocument config;
    bool validated;
};
```

#### 4. Device Mediator
**File:** `src/device_mediator.h` (to be created)

```cpp
class DeviceMediator {
public:
    // Initialize hardware from registry
    bool initializeHardware(DeviceRegistry& registry);
    
    // Sensor management
    bool readSensor(const std::string& id, float& value);
    bool calibrateSensor(const std::string& id);
    
    // Actuator management
    bool setActuator(const std::string& id, int value);
    bool getActuatorState(const std::string& id, int& value);
    
    // Lifecycle management
    void enableSensor(const std::string& id);
    void disableSensor(const std::string& id);
    void enableActuator(const std::string& id);
    void disableActuator(const std::string& id);
    
private:
    std::map<std::string, SensorDriver*> sensors;
    std::map<std::string, ActuatorDriver*> actuators;
};
```

#### 5. Abstract Type System
**File:** `src/abstract_types.h` (to be created)

```cpp
// Abstract sensor interface
class ISensor {
public:
    virtual bool read(float& value) = 0;
    virtual bool calibrate(float offset, float scale) = 0;
    virtual std::string getType() = 0;
};

// Concrete implementations
class TemperatureSensor : public ISensor { ... };
class HumiditySensor : public ISensor { ... };
class PressureSensor : public ISensor { ... };

// Abstract actuator interface
class IActuator {
public:
    virtual bool set(int value) = 0;
    virtual bool get(int& value) = 0;
    virtual std::string getType() = 0;
};

// Concrete implementations
class RelayActuator : public IActuator { ... };
class ServoActuator : public IActuator { ... };
class PWMActuator : public IActuator { ... };
```

### Integration Points

1. **Scheduler Integration**
   - Load scheduler config from registry
   - Apply quantum, max contexts, priority levels

2. **Library Integration**
   - Auto-load libraries marked in config
   - Use library paths from registry

3. **Network Integration**
   - Configure WiFi from registry
   - Setup MQTT if enabled
   - Start HTTP server with configured port

---

## Phase 8: Broker API & SD Chunkstore

### Overview
Implement inter-device messaging via HTTP broker and wear-leveling storage system for flash memory.

### Architecture

#### 1. Broker Client
**File:** `src/broker_client.h` (to be created)

```cpp
class BrokerClient {
public:
    BrokerClient(const BrokerConfig& config);
    
    // Discovery
    bool startDiscovery();
    std::vector<DeviceInfo> discoverDevices();
    bool registerDevice(const DeviceInfo& info);
    
    // Messaging
    bool sendMessage(const std::string& targetDevice,
                    const std::string& queue,
                    const std::string& message);
    
    bool receiveMessage(const std::string& queue,
                       std::string& outMessage,
                       uint32_t timeoutMs);
    
    bool receiveMessageNonBlocking(const std::string& queue,
                                   std::string& outMessage);
    
    // Queue management
    bool createQueue(const std::string& name, int maxSize);
    bool deleteQueue(const std::string& name);
    int getQueueSize(const std::string& name);
    
private:
    HTTPClient httpClient;
    WiFiUDP udpClient;
    std::map<std::string, MessageQueue> queues;
};
```

#### 2. Device Discovery Protocol
**UDP Broadcast Format:**
```json
{
  "type": "discovery",
  "deviceId": "esp32-backend-01",
  "role": "backend",
  "ip": "192.168.1.100",
  "port": 5001,
  "timestamp": 1686499200
}
```

**Discovery Process:**
1. Device broadcasts presence every 30 seconds
2. Listening devices update their peer table
3. HTTP endpoint for direct queries
4. Heartbeat mechanism for liveness detection

#### 3. Message Queue System
**File:** `src/message_queue.h` (to be created)

```cpp
class MessageQueue {
public:
    MessageQueue(const std::string& name, int maxSize, bool persistent);
    
    bool push(const std::string& message);
    bool pop(std::string& message);
    bool peek(std::string& message);
    
    int size() const;
    bool isEmpty() const;
    bool isFull() const;
    
    // Persistence
    bool save();
    bool load();
    
private:
    std::string name;
    std::deque<std::string> messages;
    int maxSize;
    bool persistent;
    std::string persistPath;
};
```

#### 4. SD Chunkstore
**File:** `src/sd_chunkstore.h` (to be created)

```cpp
struct ChunkHeader {
    uint32_t magic;         // 0x50434F44 ("PCOD")
    uint32_t chunkId;       // Unique chunk ID
    uint32_t nextChunkId;   // Next chunk in chain (0 = end)
    uint16_t dataLength;    // Actual data length
    uint16_t checksum;      // CRC16 checksum
};

class SDChunkstore {
public:
    SDChunkstore(int csPin, int chunkSize = 512);
    
    // Initialization
    bool begin();
    bool format();
    
    // File operations
    int open(const std::string& path, int mode);
    int read(int handle, uint8_t* buffer, int size);
    int write(int handle, const uint8_t* data, int size);
    bool close(int handle);
    
    // Chunk management
    uint32_t allocateChunk();
    bool freeChunk(uint32_t chunkId);
    bool readChunk(uint32_t chunkId, uint8_t* buffer);
    bool writeChunk(uint32_t chunkId, const uint8_t* data);
    
    // Wear leveling
    uint32_t getWriteCount(uint32_t chunkId);
    void balanceWear();
    
    // Garbage collection
    void collectGarbage();
    
private:
    int csPin;
    int chunkSize;
    std::map<uint32_t, ChunkHeader> chunkTable;
    std::map<uint32_t, uint32_t> wearCounts;
    std::map<int, FileHandle> openFiles;
};
```

#### 5. FILE_* Opcode Integration
**Update:** `src/pmachine_opcodes_extended.cpp`

Replace placeholder implementations with real SD chunkstore calls:

```cpp
void handle_FILE_OPEN(PMachine& vm, PMachineScheduler& scheduler,
                      const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get filename and mode from stack
    std::string filename = getStringFromStack(stack);
    int mode = stack.back(); stack.pop_back();
    
    // Open file via chunkstore
    int handle = globalChunkstore->open(filename, mode);
    
    stack.push_back(handle);
    pc++;
}

void handle_FILE_READ(PMachine& vm, PMachineScheduler& scheduler,
                      const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    int size = stack.back(); stack.pop_back();
    int bufferAddr = stack.back(); stack.pop_back();
    int handle = stack.back(); stack.pop_back();
    
    uint8_t* buffer = getBufferFromAddress(bufferAddr);
    int bytesRead = globalChunkstore->read(handle, buffer, size);
    
    stack.push_back(bytesRead);
    pc++;
}

// Similar for FILE_WRITE, FILE_CLOSE, FILE_SEEK, etc.
```

### Message Patterns

#### 1. Request/Response
```cpp
// Sender
broker.sendMessage("backend-01", "requests", requestJson);
broker.receiveMessage("responses", responseJson, 5000);

// Receiver
broker.receiveMessage("requests", requestJson, 0);
// Process request
broker.sendMessage(senderId, "responses", responseJson);
```

#### 2. Fire-and-Forget
```cpp
broker.sendMessage("logger", "events", eventJson);
// No response expected
```

#### 3. Broadcast
```cpp
// Send to all devices
for (auto& device : broker.discoverDevices()) {
    broker.sendMessage(device.id, "broadcast", message);
}
```

### Storage Layout

#### SD Card Structure
```
/
├── config/
│   └── device-config.json
├── libraries/
│   ├── crypto-utils.manifest.json
│   ├── json-parser.manifest.json
│   └── math-extended.manifest.json
├── pcode/
│   ├── main.pcode
│   └── libraries/
│       ├── crypto-utils.pcode
│       └── json-parser.pcode
├── data/
│   ├── queues/
│   │   ├── incoming.dat
│   │   └── processing.dat
│   └── logs/
│       └── system.log
└── chunks/
    ├── metadata.dat
    └── chunks.dat
```

### Performance Considerations

#### Broker
- **Latency:** < 50ms for local network
- **Throughput:** ~100 messages/second
- **Queue Size:** Configurable, default 100 messages
- **Discovery:** 30-second broadcast interval

#### Chunkstore
- **Chunk Size:** 512 bytes (configurable)
- **Write Speed:** ~100 KB/s
- **Read Speed:** ~200 KB/s
- **Wear Leveling:** Automatic balancing every 1000 writes
- **Garbage Collection:** Triggered at 80% capacity

### Testing Strategy

#### Phase 7 Tests
1. Schema validation tests
2. Config loading tests
3. Device mediator tests
4. Sensor/actuator abstraction tests
5. Integration with scheduler

#### Phase 8 Tests
1. Broker discovery tests
2. Message queue tests
3. Chunkstore allocation tests
4. Wear leveling tests
5. FILE_* opcode tests
6. End-to-end messaging tests

### Implementation Timeline

#### Phase 7 (Estimated: 1-2 weeks)
- Day 1-2: Device registry implementation
- Day 3-4: Device mediator and abstract types
- Day 5-6: Integration and testing
- Day 7: Documentation

#### Phase 8 (Estimated: 2-3 weeks)
- Day 1-3: Broker client and discovery
- Day 4-6: Message queue system
- Day 7-10: SD chunkstore implementation
- Day 11-12: FILE_* opcode integration
- Day 13-14: Testing and optimization
- Day 15: Documentation

### Dependencies

**Phase 7:**
- ArduinoJson library (for JSON parsing)
- Existing scheduler system
- Existing library loader

**Phase 8:**
- HTTPClient library
- WiFiUDP library
- SD library
- SPI library
- Existing FILE_* opcode stubs

### Success Criteria

#### Phase 7
- [x] JSON schema defined
- [x] Example configuration created
- [ ] Device registry implemented
- [ ] Schema validation working
- [ ] Device mediator functional
- [ ] All sensors/actuators abstracted
- [ ] Integration tests passing

#### Phase 8
- [ ] Broker client implemented
- [ ] Device discovery working
- [ ] Message queues functional
- [ ] SD chunkstore operational
- [ ] Wear leveling verified
- [ ] FILE_* opcodes integrated
- [ ] End-to-end tests passing

---

## Next Steps

1. **Immediate:** Implement DeviceRegistry class
2. **Short-term:** Complete Phase 7 device mediator
3. **Medium-term:** Implement broker client for Phase 8
4. **Long-term:** Complete SD chunkstore with wear leveling

---

**Last Updated:** June 11, 2026  
**Status:** Phases 5-6 Complete, Phases 7-8 In Design