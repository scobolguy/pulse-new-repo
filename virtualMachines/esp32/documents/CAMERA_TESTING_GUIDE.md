# ESP32-CAM Testing Guide

## Prerequisites

1. **Hardware:**
   - ESP32-CAM board (AI-Thinker or compatible)
   - USB-to-Serial adapter (FTDI or CP2102)
   - 5V 2A power supply (important for stable camera operation)
   - Camera module properly connected

2. **Software:**
   - PlatformIO installed
   - ESP32-CAM connected to your computer

## Step 1: Build and Upload

### Build for ESP32-CAM

```bash
# Navigate to project directory
cd c:/dev/pulse-new-repo/virtualMachines/esp32

# Build for ESP32-CAM
platformio run -e esp32cam

# Upload to device (adjust COM port as needed)
platformio run -e esp32cam --target upload

# Monitor serial output
platformio device monitor -e esp32cam
```

### Expected Serial Output

```
[Camera] Initialized successfully
[Camera Routes] Registered all camera API endpoints
[Main] Camera initialized
Camera Status:
  Initialized: Yes
  Streaming: No
  Motion Detection: Disabled
  Frame Count: 0
```

## Step 2: Find ESP32-CAM IP Address

Check serial monitor for WiFi connection:
```
WiFi connected
IP address: 192.168.1.100
```

Or use network discovery:
```bash
# Windows
arp -a | findstr "192.168"

# Linux/Mac
arp -a | grep "192.168"
```

## Step 3: Basic API Testing

### Test 1: Check Camera Status

```bash
curl http://192.168.1.100/api/camera/status
```

**Expected Response:**
```json
{
  "initialized": true,
  "streaming": false,
  "motionDetection": false,
  "frameCount": 0,
  "lastFrameSize": 0,
  "lastCaptureTime": 0,
  "config": {
    "resolution": 3,
    "quality": 20,
    "verticalFlip": false,
    "horizontalMirror": false,
    "brightness": 0,
    "contrast": 0,
    "saturation": 0
  }
}
```

### Test 2: Capture Snapshot

```bash
curl -X POST http://192.168.1.100/api/camera/snapshot
```

**Expected Response:**
```json
{
  "success": true,
  "path": "/snapshots/snapshot_1234567890.jpg",
  "size": 15234,
  "timestamp": 1234567890
}
```

### Test 3: View Live Stream

Open in browser:
```
http://192.168.1.100/api/camera/stream
```

Or use VLC:
```bash
vlc http://192.168.1.100/api/camera/stream
```

### Test 4: Enable Motion Detection

```bash
curl -X POST http://192.168.1.100/api/camera/motion/enable \
  -H "Content-Type: application/json" \
  -d '{"threshold":20,"minBlocks":10,"cooldownMs":2000}'
```

### Test 5: Check for Motion

```bash
# Wave your hand in front of camera, then:
curl http://192.168.1.100/api/camera/motion/check
```

**Expected Response (motion detected):**
```json
{
  "motionDetected": true,
  "timestamp": 1234567890,
  "changedBlocks": 25,
  "changePercentage": 12.5,
  "snapshotPath": "/motion/motion_1234567890.jpg"
}
```

### Test 6: Adjust Image Settings

```bash
# Increase brightness
curl -X POST http://192.168.1.100/api/camera/adjust/brightness \
  -d "level=1"

# Increase contrast
curl -X POST http://192.168.1.100/api/camera/adjust/contrast \
  -d "level=1"

# Decrease saturation
curl -X POST http://192.168.1.100/api/camera/adjust/saturation \
  -d "level=-1"
```

### Test 7: Capture Timelapse

```bash
curl -X POST http://192.168.1.100/api/camera/timelapse \
  -H "Content-Type: application/json" \
  -d '{"intervalMs":2000,"count":5,"prefix":"test"}'
```

This will capture 5 images at 2-second intervals.

## Step 4: Web Interface Testing

Create a test HTML file (`test-camera.html`):

```html
<!DOCTYPE html>
<html>
<head>
    <title>ESP32-CAM Test Interface</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .video-container { margin: 20px 0; }
        img { max-width: 100%; border: 2px solid #333; }
        button { padding: 10px 20px; margin: 5px; font-size: 16px; }
        .status { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        .controls { margin: 20px 0; }
        input[type="range"] { width: 200px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ESP32-CAM Test Interface</h1>
        
        <div class="status" id="status">
            <h3>Camera Status</h3>
            <pre id="statusText">Loading...</pre>
        </div>

        <div class="video-container">
            <h3>Live Stream</h3>
            <img id="stream" src="" alt="Camera stream will appear here" />
        </div>

        <div class="controls">
            <h3>Controls</h3>
            <button onclick="startStream()">Start Stream</button>
            <button onclick="stopStream()">Stop Stream</button>
            <button onclick="captureSnapshot()">Take Snapshot</button>
            <button onclick="toggleMotion()">Toggle Motion Detection</button>
            <button onclick="checkMotion()">Check Motion</button>
        </div>

        <div class="controls">
            <h3>Image Adjustments</h3>
            <label>Brightness: <input type="range" min="-2" max="2" value="0" 
                   onchange="adjustBrightness(this.value)"> <span id="brightness">0</span></label><br>
            <label>Contrast: <input type="range" min="-2" max="2" value="0" 
                   onchange="adjustContrast(this.value)"> <span id="contrast">0</span></label><br>
            <label>Saturation: <input type="range" min="-2" max="2" value="0" 
                   onchange="adjustSaturation(this.value)"> <span id="saturation">0</span></label>
        </div>

        <div class="controls">
            <h3>Timelapse</h3>
            <label>Interval (ms): <input type="number" id="interval" value="2000"></label><br>
            <label>Count: <input type="number" id="count" value="5"></label><br>
            <button onclick="captureTimelapse()">Start Timelapse</button>
        </div>

        <div id="log" style="background: #f9f9f9; padding: 10px; margin-top: 20px; max-height: 300px; overflow-y: auto;">
            <h3>Log</h3>
            <pre id="logText"></pre>
        </div>
    </div>

    <script>
        const ESP32_IP = 'http://192.168.1.100'; // Change to your ESP32-CAM IP
        
        function log(message) {
            const logText = document.getElementById('logText');
            const timestamp = new Date().toLocaleTimeString();
            logText.textContent += `[${timestamp}] ${message}\n`;
            logText.parentElement.scrollTop = logText.parentElement.scrollHeight;
        }

        async function updateStatus() {
            try {
                const response = await fetch(`${ESP32_IP}/api/camera/status`);
                const data = await response.json();
                document.getElementById('statusText').textContent = JSON.stringify(data, null, 2);
                log('Status updated');
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        function startStream() {
            document.getElementById('stream').src = `${ESP32_IP}/api/camera/stream?t=${Date.now()}`;
            log('Stream started');
        }

        function stopStream() {
            document.getElementById('stream').src = '';
            fetch(`${ESP32_IP}/api/camera/stream/stop`, { method: 'POST' });
            log('Stream stopped');
        }

        async function captureSnapshot() {
            try {
                const response = await fetch(`${ESP32_IP}/api/camera/snapshot`, { method: 'POST' });
                const data = await response.json();
                log(`Snapshot captured: ${data.path} (${data.size} bytes)`);
                updateStatus();
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        async function toggleMotion() {
            try {
                const status = await fetch(`${ESP32_IP}/api/camera/status`).then(r => r.json());
                const endpoint = status.motionDetection ? 
                    '/api/camera/motion/disable' : 
                    '/api/camera/motion/enable';
                
                const response = await fetch(`${ESP32_IP}${endpoint}`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ threshold: 20, minBlocks: 10, cooldownMs: 2000 })
                });
                const data = await response.json();
                log(`Motion detection ${data.enabled ? 'enabled' : 'disabled'}`);
                updateStatus();
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        async function checkMotion() {
            try {
                const response = await fetch(`${ESP32_IP}/api/camera/motion/check`);
                const data = await response.json();
                if (data.motionDetected) {
                    log(`Motion detected! Changed blocks: ${data.changedBlocks} (${data.changePercentage.toFixed(1)}%)`);
                    log(`Snapshot: ${data.snapshotPath}`);
                } else {
                    log('No motion detected');
                }
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        async function adjustBrightness(level) {
            try {
                await fetch(`${ESP32_IP}/api/camera/adjust/brightness`, {
                    method: 'POST',
                    body: `level=${level}`
                });
                document.getElementById('brightness').textContent = level;
                log(`Brightness adjusted to ${level}`);
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        async function adjustContrast(level) {
            try {
                await fetch(`${ESP32_IP}/api/camera/adjust/contrast`, {
                    method: 'POST',
                    body: `level=${level}`
                });
                document.getElementById('contrast').textContent = level;
                log(`Contrast adjusted to ${level}`);
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        async function adjustSaturation(level) {
            try {
                await fetch(`${ESP32_IP}/api/camera/adjust/saturation`, {
                    method: 'POST',
                    body: `level=${level}`
                });
                document.getElementById('saturation').textContent = level;
                log(`Saturation adjusted to ${level}`);
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        async function captureTimelapse() {
            const interval = document.getElementById('interval').value;
            const count = document.getElementById('count').value;
            
            try {
                log(`Starting timelapse: ${count} frames at ${interval}ms intervals...`);
                const response = await fetch(`${ESP32_IP}/api/camera/timelapse`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        intervalMs: parseInt(interval), 
                        count: parseInt(count),
                        prefix: 'test'
                    })
                });
                const data = await response.json();
                log(`Timelapse complete: ${data.count} frames captured`);
                updateStatus();
            } catch (error) {
                log('Error: ' + error.message);
            }
        }

        // Auto-update status every 5 seconds
        setInterval(updateStatus, 5000);
        
        // Initial status update
        updateStatus();
        
        log('Test interface loaded. Update ESP32_IP constant with your device IP.');
    </script>
</body>
</html>
```

Save this file and open it in a browser. Update the `ESP32_IP` constant with your ESP32-CAM's IP address.

## Step 5: Automated Test Script

Create `scripts/test-camera.mjs`:

```javascript
import fetch from 'node-fetch';

const ESP32_IP = 'http://192.168.1.100'; // Change to your ESP32-CAM IP

async function runTests() {
    console.log('🎥 ESP32-CAM Test Suite\n');

    // Test 1: Status
    console.log('Test 1: Camera Status');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/status`);
        const data = await response.json();
        console.log('✅ Status:', data.initialized ? 'Initialized' : 'Not initialized');
        console.log(`   Frame count: ${data.frameCount}`);
    } catch (error) {
        console.log('❌ Failed:', error.message);
        return;
    }

    // Test 2: Snapshot
    console.log('\nTest 2: Capture Snapshot');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/snapshot`, { method: 'POST' });
        const data = await response.json();
        console.log('✅ Snapshot captured:', data.path);
        console.log(`   Size: ${data.size} bytes`);
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 3: Enable Motion Detection
    console.log('\nTest 3: Enable Motion Detection');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/motion/enable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold: 20, minBlocks: 10, cooldownMs: 2000 })
        });
        const data = await response.json();
        console.log('✅ Motion detection:', data.enabled ? 'Enabled' : 'Failed');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 4: Check Motion
    console.log('\nTest 4: Check Motion (wave hand in front of camera)');
    console.log('   Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/motion/check`);
        const data = await response.json();
        if (data.motionDetected) {
            console.log('✅ Motion detected!');
            console.log(`   Changed blocks: ${data.changedBlocks}`);
            console.log(`   Change percentage: ${data.changePercentage.toFixed(1)}%`);
        } else {
            console.log('ℹ️  No motion detected');
        }
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 5: Adjust Settings
    console.log('\nTest 5: Adjust Image Settings');
    try {
        await fetch(`${ESP32_IP}/api/camera/adjust/brightness`, {
            method: 'POST',
            body: 'level=1'
        });
        console.log('✅ Brightness adjusted');

        await fetch(`${ESP32_IP}/api/camera/adjust/contrast`, {
            method: 'POST',
            body: 'level=1'
        });
        console.log('✅ Contrast adjusted');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 6: Timelapse
    console.log('\nTest 6: Timelapse (3 frames, 1 second apart)');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/timelapse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intervalMs: 1000, count: 3, prefix: 'test' })
        });
        const data = await response.json();
        console.log('✅ Timelapse complete:', data.count, 'frames');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Final Status
    console.log('\nFinal Status:');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/status`);
        const data = await response.json();
        console.log(`   Frame count: ${data.frameCount}`);
        console.log(`   Last frame size: ${data.lastFrameSize} bytes`);
        console.log(`   Motion detection: ${data.motionDetection ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    console.log('\n✨ Test suite complete!');
}

runTests().catch(console.error);
```

Run the test script:
```bash
node scripts/test-camera.mjs
```

## Troubleshooting

### Camera Not Initializing

1. Check serial output for error codes
2. Verify camera module is properly connected
3. Ensure adequate power supply (5V 2A minimum)
4. Try different GPIO pin configurations if using non-AI-Thinker board

### Poor Image Quality

1. Adjust lighting conditions
2. Clean camera lens
3. Adjust brightness/contrast settings
4. Try different quality settings

### Motion Detection Not Working

1. Ensure adequate lighting
2. Adjust threshold (lower = more sensitive)
3. Reduce minBlocks for smaller movements
4. Check cooldown period isn't too long

### Stream Not Loading

1. Check network connectivity
2. Verify IP address is correct
3. Try different browser
4. Check firewall settings

## Performance Benchmarks

Expected performance on ESP32-CAM:

| Resolution | Frame Rate | Snapshot Time | File Size |
|------------|-----------|---------------|-----------|
| QQVGA      | 25-30 FPS | ~50ms        | 2-5 KB    |
| QVGA       | 20-25 FPS | ~80ms        | 5-10 KB   |
| VGA        | 15-20 FPS | ~120ms       | 10-20 KB  |
| SVGA       | 10-15 FPS | ~180ms       | 15-30 KB  |
| XGA        | 5-10 FPS  | ~250ms       | 25-50 KB  |

Motion detection adds ~20-50ms overhead per frame.