const MELCloudAPI = require('./index');

/**
 * Simple test script
 * Create a test-config.js file with your credentials:
 * 
 * module.exports = {
 *     email: 'your-email@example.com',
 *     password: 'your-password'
 * };
 */

async function test() {
    try {
        // Load credentials from config file (not committed to git)
        const config = require('./test-config');
        const client = new MELCloudAPI(config.email, config.password);

        console.log('Testing MELCloud API...\n');

        // Test 1: Login
        console.log('1. Testing login...');
        await client.login();
        console.log('✓ Login successful\n');

        // Test 2: Get all devices
        console.log('2. Getting all devices...');
        const devices = await client.getDevices();
        console.log(`✓ Found ${devices.length} device(s):\n`);
        
        devices.forEach(device => {
            console.log(`   ${device.name} (ID: ${device.id})`);
            console.log(`   - Power: ${device.power ? 'ON' : 'OFF'}`);
            console.log(`   - Temperature: ${device.temperature}°C (Room: ${device.roomTemperature}°C)`);
            console.log(`   - Mode: ${device.mode}`);
            console.log(`   - Fan: ${device.fanSpeed}`);
            console.log('');
        });

        if (devices.length > 0) {
            const deviceId = devices[0].id;

            // Test 3: Get specific device
            console.log(`3. Getting device ${deviceId} details...`);
            const device = await client.getDevice(deviceId);
            console.log('✓ Device details retrieved\n');

            // Test 4: Set device (comment out if you don't want to actually change settings)
            console.log('4. Testing device control...');
            console.log('   (Skipped - uncomment in test.js to actually test control)');
            // await client.setDevice(deviceId, { fanSpeed: 'auto' });
            // console.log('✓ Device control successful\n');
        }

        console.log('All tests completed successfully!');

    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run if config file exists
try {
    require.resolve('./test-config');
    test();
} catch (e) {
    console.log('To run tests, create a test-config.js file with your MELCloud credentials:');
    console.log('');
    console.log('module.exports = {');
    console.log('    email: "your-email@example.com",');
    console.log('    password: "your-password"');
    console.log('};');
}
