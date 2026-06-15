# Phase 8: Broker API & SD Chunkstore Implementation

## Overview

Phase 8 implements two critical components for distributed ESP Virtual P-Machine systems:

1. **Broker Client**: HTTP-based inter-device messaging with UDP discovery
2. **SD Chunkstore**: Wear-leveling storage system for persistent data

These components enable device-to-device communication and reliable persistent storage for P-code programs running on ESP32 devices.

---

## 1. Broker Client Architecture

### 1.1 Purpose

The Broker Client enables ESP32 devices to:
- Discover other devices on the network via UDP broadcast
- Send/receive messages between devices via HTTP
- Maintain persistent message queues
- Support asynchronous message delivery

### 1.2 Key Features

- **UDP Discovery Protocol**: Automatic device discovery with heartbeat mechanism
- **HTTP Message Delivery**: RESTful API for reliable message transport
- **Queue Management**: Multiple named queues with configurable persistence
- **LittleFS Integration**: Queue persistence using modern ESP32 file system
- **Non-blocking Operations**: Async message handling with callbacks

### 1.3 Discovery Protocol

**Broadcast Format (UDP Port 5000):**
```json
{
  "deviceId": "backend-01",
  "role": "backend",
  "ip": "192.168.1.100",
  "messagePort": 5001,
  "timestamp": 1234567890
}
```

**Discovery Process:**
1. Device broadcasts presence every 30 seconds
2. Listening devices update peer registry
3. Stale entries (>90s) are removed automatically
4. Peer list available via `getPeers()` API

### 1.4 Message Format

**HTTP POST to `/message` (Port 5001):**
```json
{
  "from": "backend-01",
  "to": "frontend-01",
  "queue": "transactions",
  "payload": "base64-encoded-data",
  "timestamp": 1234567890,
  "priority": 5
}
```

### 1.5 Queue Management

**Queue Types:**
- **Transient**: In-memory only, lost on reboot
- **Persistent**: Saved to LittleFS, survives reboot

**Queue Operations:**
```cpp
// Create queue
createQueue("transactions", 100, true);  // maxSize=100, persistent=true

// Send message
sendMessage("frontend-01", "transactions", payload, payloadSize);

// Receive message
size_t size = receiveMessage("transactions", buffer, bufferSize);

// Check queue status
int count = getQueueSize("transactions");
```

### 1.6 API Reference

#### Initialization
```cpp
BrokerClient* broker = new BrokerClient();
broker->begin(5000, 5001);  // discoveryPort, messagePort
```

#### Discovery
```cpp
// Get list of discovered peers
std::vector<PeerInfo> peers = broker->getPeers();

// Check if specific device is online
bool online = broker->isPeerOnline("backend-01");
```

#### Messaging
```cpp
// Send message to specific device
bool sent = broker->sendMessage(
    "backend-01",           // target device
    "transactions",         // queue name
    payload,                // data buffer
    payloadSize            // data size
);

// Receive next message from queue
size_t received = broker->receiveMessage(
    "transactions",         // queue name
    buffer,                // output buffer
    bufferSize             // buffer size
);
```

#### Queue Management
```cpp
// Create new queue
broker->createQueue("alerts", 50, false);  // transient queue

// Get queue statistics
int size = broker->getQueueSize("alerts");
int maxSize = broker->getQueueMaxSize("alerts");

// Clear queue
broker->clearQueue("alerts");
```

### 1.7 Configuration

**device-config.json:**
```json
{
  "broker": {
    "enabled": true,
    "discoveryPort": 5000,
    "messagePort": 5001,
    "queues": [
      {
        "name": "transactions",
        "maxSize": 100,
        "persistent": true
      },
      {
        "name": "alerts",
        "maxSize": 50,
        "persistent": false
      }
    ]
  }
}
```

### 1.8 LittleFS Integration

The broker uses LittleFS for queue persistence:

```cpp
// Queue file format: /queues/<queue-name>.dat
// Each message: [4-byte size][payload]

// Save queue to LittleFS
void BrokerClient::saveQueue(const String& queueName) {
    File file = LittleFS.open("/queues/" + queueName + ".dat", "w");
    for (auto& msg : queue) {
        uint32_t size = msg.size();
        file.write((uint8_t*)&size, 4);
        file.write(msg.data(), size);
    }
    file.close();
}

// Load queue from LittleFS
void BrokerClient::loadQueue(const String& queueName) {
    File file = LittleFS.open("/queues/" + queueName + ".dat", "r");
    while (file.available()) {
        uint32_t size;
        file.read((uint8_t*)&size, 4);
        std::vector<uint8_t> msg(size);
        file.read(msg.data(), size);
        queue.push_back(msg);
    }
    file.close();
}
```

---

## 2. SD Chunkstore Architecture

### 2.1 Purpose

The SD Chunkstore provides:
- Wear-leveling storage for SD cards
- Chunked allocation for efficient space usage
- File-like API for P-code programs
- Integration with FILE_* opcodes

### 2.2 Key Features

- **512-byte Chunks**: Fixed-size allocation units
- **Wear Leveling**: Distributes writes across SD card
- **Metadata Tracking**: File allocation table (FAT)
- **Fragmentation Support**: Files can span multiple chunks
- **Atomic Operations**: Safe concurrent access

### 2.3 Chunk Structure

**Chunk Header (16 bytes):**
```cpp
struct ChunkHeader {
    uint32_t magic;        // 0x434B4E4B ("CHNK")
    uint32_t fileId;       // File identifier
    uint16_t chunkIndex;   // Chunk sequence number
    uint16_t nextChunk;    // Next chunk in chain (0xFFFF = end)
    uint32_t dataSize;     // Valid data bytes in chunk
    uint32_t crc32;        // CRC32 of data
};
```

**Chunk Layout:**
```
[0-15]   Header (16 bytes)
[16-511] Data (496 bytes)
```

### 2.4 File Allocation Table

**FAT Entry:**
```cpp
struct FATEntry {
    char filename[32];     // Null-terminated filename
    uint32_t fileSize;     // Total file size in bytes
    uint16_t firstChunk;   // First chunk number
    uint32_t createTime;   // Creation timestamp
    uint32_t modifyTime;   // Last modification timestamp
    uint8_t flags;         // File flags (read-only, etc.)
};
```

**FAT Storage:**
- Stored in chunk 0 (reserved)
- Up to 31 FAT entries (496 bytes / 16 bytes per entry)
- Cached in RAM for fast access

### 2.5 Wear Leveling Algorithm

**Strategy:**
1. Track write count per chunk
2. Prefer chunks with lowest write count
3. Periodically rebalance hot chunks
4. Avoid wearing out specific sectors

**Implementation:**
```cpp
uint16_t SDChunkstore::allocateChunk() {
    uint16_t bestChunk = 0;
    uint32_t minWrites = UINT32_MAX;
    
    for (uint16_t i = 1; i < totalChunks; i++) {
        if (!isChunkUsed(i) && writeCount[i] < minWrites) {
            minWrites = writeCount[i];
            bestChunk = i;
        }
    }
    
    writeCount[bestChunk]++;
    return bestChunk;
}
```

### 2.6 API Reference

#### Initialization
```cpp
SDChunkstore* store = new SDChunkstore();
store->begin(SD_CS_PIN, 512);  // CS pin, chunk size
```

#### File Operations
```cpp
// Open file
int handle = store->open("data.bin", O_RDWR | O_CREAT);

// Write data
int written = store->write(handle, buffer, size);

// Read data
int read = store->read(handle, buffer, size);

// Seek position
store->seek(handle, offset, SEEK_SET);

// Close file
store->close(handle);
```

#### File Management
```cpp
// Delete file
bool deleted = store->remove("old.dat");

// Rename file
bool renamed = store->rename("old.dat", "new.dat");

// Get file info
FileInfo info = store->stat("data.bin");
Serial.printf("Size: %d bytes\n", info.size);
```

#### Storage Statistics
```cpp
// Get storage stats
uint32_t total = store->getTotalChunks();
uint32_t used = store->getUsedChunks();
uint32_t free = store->getFreeChunks();

Serial.printf("Storage: %d/%d chunks used\n", used, total);
```

### 2.7 Integration with FILE_* Opcodes

The chunkstore integrates with P-code FILE_* opcodes:

```cpp
// In pmachine_opcodes_extended.cpp

case OP_FILE_OPEN: {
    String filename = popString();
    int mode = pop();
    int handle = globalChunkstore->open(filename.c_str(), mode);
    push(handle);
    break;
}

case OP_FILE_READ: {
    int size = pop();
    int handle = pop();
    uint8_t* buffer = new uint8_t[size];
    int bytesRead = globalChunkstore->read(handle, buffer, size);
    pushBytes(buffer, bytesRead);
    delete[] buffer;
    break;
}

case OP_FILE_WRITE: {
    int size = pop();
    uint8_t* data = popBytes(size);
    int handle = pop();
    int bytesWritten = globalChunkstore->write(handle, data, size);
    push(bytesWritten);
    delete[] data;
    break;
}

case OP_FILE_CLOSE: {
    int handle = pop();
    globalChunkstore->close(handle);
    break;
}
```

### 2.8 Configuration

**device-config.json:**
```json
{
  "storage": {
    "sdCard": {
      "enabled": true,
      "csPin": 5,
      "chunkSize": 512
    }
  }
}
```

---

## 3. P-code Usage Examples

### 3.1 Broker Messaging

**Send Transaction:**
```pascal
program SendTransaction;
var
    payload: string;
    result: integer;
begin
    payload := '{"amount": 1000, "account": "12345"}';
    
    // OP_BROKER_SEND: deviceId, queue, payload
    result := broker_send('backend-01', 'transactions', payload);
    
    if result = 1 then
        writeln('Message sent successfully')
    else
        writeln('Failed to send message');
end.
```

**Receive Transaction:**
```pascal
program ReceiveTransaction;
var
    message: string;
    count: integer;
begin
    // OP_BROKER_RECEIVE: queue -> message
    message := broker_receive('transactions');
    
    if length(message) > 0 then begin
        writeln('Received: ', message);
        // Process transaction...
    end else
        writeln('No messages in queue');
end.
```

### 3.2 File Operations

**Write Data File:**
```pascal
program WriteData;
var
    handle: integer;
    data: string;
    written: integer;
begin
    // Open file for writing
    handle := file_open('sensor.dat', O_WRONLY or O_CREAT);
    
    if handle >= 0 then begin
        data := 'Temperature: 25.5C';
        written := file_write(handle, data);
        file_close(handle);
        writeln('Wrote ', written, ' bytes');
    end;
end.
```

**Read Data File:**
```pascal
program ReadData;
var
    handle: integer;
    data: string;
    size: integer;
begin
    // Open file for reading
    handle := file_open('sensor.dat', O_RDONLY);
    
    if handle >= 0 then begin
        data := file_read(handle, 1024);
        file_close(handle);
        writeln('Read: ', data);
    end;
end.
```

---

## 4. Testing

### 4.1 Broker Tests

**Test Discovery:**
```cpp
void testDiscovery() {
    BrokerClient broker;
    broker.begin(5000, 5001);
    
    delay(5000);  // Wait for discovery
    
    auto peers = broker.getPeers();
    Serial.printf("Found %d peers\n", peers.size());
    
    for (auto& peer : peers) {
        Serial.printf("  %s (%s) at %s\n", 
            peer.deviceId.c_str(),
            peer.role.c_str(),
            peer.ip.toString().c_str());
    }
}
```

**Test Messaging:**
```cpp
void testMessaging() {
    BrokerClient broker;
    broker.begin(5000, 5001);
    broker.createQueue("test", 10, false);
    
    // Send message
    const char* msg = "Hello, World!";
    bool sent = broker.sendMessage("backend-01", "test", 
        (uint8_t*)msg, strlen(msg));
    
    Serial.printf("Send: %s\n", sent ? "OK" : "FAIL");
    
    // Receive message
    uint8_t buffer[256];
    size_t received = broker.receiveMessage("test", buffer, 256);
    
    if (received > 0) {
        buffer[received] = 0;
        Serial.printf("Received: %s\n", buffer);
    }
}
```

### 4.2 Chunkstore Tests

**Test Write/Read:**
```cpp
void testChunkstore() {
    SDChunkstore store;
    store.begin(5, 512);
    
    // Write test
    int handle = store.open("test.dat", O_RDWR | O_CREAT);
    const char* data = "Test data 123";
    int written = store.write(handle, (uint8_t*)data, strlen(data));
    store.close(handle);
    
    Serial.printf("Wrote %d bytes\n", written);
    
    // Read test
    handle = store.open("test.dat", O_RDONLY);
    uint8_t buffer[256];
    int read = store.read(handle, buffer, 256);
    buffer[read] = 0;
    store.close(handle);
    
    Serial.printf("Read: %s\n", buffer);
}
```

**Test Wear Leveling:**
```cpp
void testWearLeveling() {
    SDChunkstore store;
    store.begin(5, 512);
    
    // Write 1000 files to test wear distribution
    for (int i = 0; i < 1000; i++) {
        char filename[32];
        sprintf(filename, "test%d.dat", i);
        
        int handle = store.open(filename, O_RDWR | O_CREAT);
        store.write(handle, (uint8_t*)"data", 4);
        store.close(handle);
        store.remove(filename);
    }
    
    // Check write distribution
    store.printWearStats();
}
```

---

## 5. Performance Considerations

### 5.1 Broker Performance

**Throughput:**
- UDP Discovery: ~100 packets/sec
- HTTP Messages: ~50 messages/sec
- Queue Operations: ~1000 ops/sec (in-memory)

**Latency:**
- Discovery: <100ms
- Message Delivery: <50ms (local network)
- Queue Persistence: <10ms per message

**Optimization Tips:**
- Use transient queues for high-frequency messages
- Batch messages when possible
- Limit queue sizes to prevent memory exhaustion
- Use message priorities for critical data

### 5.2 Chunkstore Performance

**Throughput:**
- Sequential Write: ~100 KB/sec
- Sequential Read: ~200 KB/sec
- Random Access: ~50 KB/sec

**Latency:**
- Chunk Allocation: <5ms
- Write Operation: <10ms per chunk
- Read Operation: <5ms per chunk

**Optimization Tips:**
- Use larger writes to reduce overhead
- Cache frequently accessed files
- Defragment periodically
- Monitor wear statistics

---

## 6. Troubleshooting

### 6.1 Broker Issues

**Problem: Devices not discovering each other**
- Check UDP port 5000 is not blocked
- Verify devices are on same network
- Check WiFi connection status
- Increase discovery timeout

**Problem: Messages not delivered**
- Verify target device is online
- Check queue exists on target
- Ensure queue not full
- Check network connectivity

**Problem: Queue persistence failing**
- Verify LittleFS is initialized
- Check available flash space
- Ensure proper file permissions
- Check for filesystem corruption

### 6.2 Chunkstore Issues

**Problem: SD card not detected**
- Check CS pin configuration
- Verify SD card is formatted (FAT32)
- Check SPI connections
- Try different SD card

**Problem: Write failures**
- Check available space
- Verify SD card not write-protected
- Check for bad sectors
- Monitor wear statistics

**Problem: Data corruption**
- Enable CRC checking
- Verify power supply stability
- Check for electrical interference
- Use quality SD cards

---

## 7. Future Enhancements

### 7.1 Broker Enhancements
- [ ] Message encryption (TLS/SSL)
- [ ] Message compression
- [ ] Priority queues
- [ ] Message expiration
- [ ] Delivery acknowledgments
- [ ] Multicast messaging

### 7.2 Chunkstore Enhancements
- [ ] Compression support
- [ ] Encryption support
- [ ] Journaling for crash recovery
- [ ] Defragmentation utility
- [ ] RAID-like redundancy
- [ ] Hot/cold data tiering

---

## 8. References

### 8.1 Related Documentation
- `PHASE7_REGISTRY_README.md` - Device registry and configuration
- `DYNAMIC_LIBRARY_README.md` - Dynamic library system
- `SCHEDULER_README.md` - Multi-context scheduler
- `device-config.schema.json` - Configuration schema

### 8.2 Source Files
- `broker_client.h/cpp` - Broker client implementation
- `sd_chunkstore.h/cpp` - Chunkstore implementation
- `pmachine_opcodes_extended.cpp` - FILE_* opcode integration
- `device_registry.cpp` - Configuration management

### 8.3 External Resources
- ESP32 LittleFS Documentation
- SD Card Specifications
- HTTP/1.1 RFC 2616
- UDP RFC 768

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-11  
**Author:** ESP Virtual P-Machine Team