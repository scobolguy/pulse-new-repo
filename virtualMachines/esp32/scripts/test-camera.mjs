import fetch from 'node-fetch';

const ESP32_IP = process.env.ESP32_IP || 'http://192.168.1.100';

async function runTests() {
    console.log('🎥 ESP32-CAM Test Suite\n');
    console.log(`Testing device at: ${ESP32_IP}\n`);

    // Test 1: Status
    console.log('Test 1: Camera Status');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/status`);
        const data = await response.json();
        console.log('✅ Status:', data.initialized ? 'Initialized' : 'Not initialized');
        console.log(`   Frame count: ${data.frameCount}`);
        console.log(`   Resolution: ${data.config.resolution}`);
        console.log(`   Quality: ${data.config.quality}`);
    } catch (error) {
        console.log('❌ Failed:', error.message);
        console.log('\nMake sure:');
        console.log('1. ESP32-CAM is powered on and connected to network');
        console.log('2. Update ESP32_IP environment variable or edit script');
        console.log('3. Camera is properly initialized in firmware');
        return;
    }

    // Test 2: Snapshot
    console.log('\nTest 2: Capture Snapshot');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/snapshot`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            console.log('✅ Snapshot captured:', data.path);
            console.log(`   Size: ${data.size} bytes`);
            console.log(`   Timestamp: ${data.timestamp}`);
        } else {
            console.log('❌ Failed:', data.error);
        }
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 3: Enable Motion Detection
    console.log('\nTest 3: Enable Motion Detection');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/motion/enable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                threshold: 20, 
                minBlocks: 10, 
                blockSize: 16,
                cooldownMs: 2000 
            })
        });
        const data = await response.json();
        console.log('✅ Motion detection:', data.enabled ? 'Enabled' : 'Failed');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 4: Check Motion
    console.log('\nTest 4: Check Motion');
    console.log('   👋 Wave your hand in front of the camera now!');
    console.log('   Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/motion/check`);
        const data = await response.json();
        if (data.motionDetected) {
            console.log('✅ Motion detected!');
            console.log(`   Changed blocks: ${data.changedBlocks}`);
            console.log(`   Change percentage: ${data.changePercentage.toFixed(1)}%`);
            console.log(`   Snapshot saved: ${data.snapshotPath}`);
        } else {
            console.log('ℹ️  No motion detected (try waving again)');
        }
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 5: Adjust Settings
    console.log('\nTest 5: Adjust Image Settings');
    try {
        let response = await fetch(`${ESP32_IP}/api/camera/adjust/brightness`, {
            method: 'POST',
            body: 'level=1'
        });
        let data = await response.json();
        console.log('✅ Brightness adjusted to', data.brightness);

        response = await fetch(`${ESP32_IP}/api/camera/adjust/contrast`, {
            method: 'POST',
            body: 'level=1'
        });
        data = await response.json();
        console.log('✅ Contrast adjusted to', data.contrast);

        response = await fetch(`${ESP32_IP}/api/camera/adjust/saturation`, {
            method: 'POST',
            body: 'level=-1'
        });
        data = await response.json();
        console.log('✅ Saturation adjusted to', data.saturation);
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 6: Configuration Update
    console.log('\nTest 6: Update Configuration');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resolution: 2, // VGA
                quality: 20,   // Medium
                verticalFlip: false,
                horizontalMirror: false
            })
        });
        const data = await response.json();
        console.log('✅ Configuration updated:', data.success ? 'Success' : 'Failed');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 7: Timelapse
    console.log('\nTest 7: Timelapse (3 frames, 1 second apart)');
    console.log('   This will take ~3 seconds...');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/timelapse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                intervalMs: 1000, 
                count: 3, 
                prefix: 'test' 
            })
        });
        const data = await response.json();
        if (data.success) {
            console.log('✅ Timelapse complete:', data.count, 'frames captured');
        } else {
            console.log('❌ Failed:', data.error);
        }
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 8: Stream Control
    console.log('\nTest 8: Stream Control');
    try {
        let response = await fetch(`${ESP32_IP}/api/camera/stream/start`, {
            method: 'POST',
            body: 'delay=100'
        });
        let data = await response.json();
        console.log('✅ Stream started:', data.streaming ? 'Yes' : 'No');

        await new Promise(resolve => setTimeout(resolve, 1000));

        response = await fetch(`${ESP32_IP}/api/camera/stream/stop`, {
            method: 'POST'
        });
        data = await response.json();
        console.log('✅ Stream stopped:', !data.streaming ? 'Yes' : 'No');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Test 9: Disable Motion Detection
    console.log('\nTest 9: Disable Motion Detection');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/motion/disable`, {
            method: 'POST'
        });
        const data = await response.json();
        console.log('✅ Motion detection disabled:', !data.enabled ? 'Yes' : 'No');
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    // Final Status
    console.log('\n📊 Final Status:');
    try {
        const response = await fetch(`${ESP32_IP}/api/camera/status`);
        const data = await response.json();
        console.log(`   Initialized: ${data.initialized}`);
        console.log(`   Streaming: ${data.streaming}`);
        console.log(`   Motion Detection: ${data.motionDetection}`);
        console.log(`   Total Frames Captured: ${data.frameCount}`);
        console.log(`   Last Frame Size: ${data.lastFrameSize} bytes`);
        console.log(`   Last Capture Time: ${data.lastCaptureTime}ms`);
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }

    console.log('\n✨ Test suite complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Open http://' + ESP32_IP.replace('http://', '') + '/api/camera/stream in browser');
    console.log('   2. Test motion detection by waving in front of camera');
    console.log('   3. Check FFS for saved snapshots');
}

// Handle command line arguments
if (process.argv.length > 2) {
    const ip = process.argv[2];
    if (ip.startsWith('http://') || ip.startsWith('https://')) {
        process.env.ESP32_IP = ip;
    } else {
        process.env.ESP32_IP = 'http://' + ip;
    }
}

runTests().catch(console.error);

// Made with Bob
