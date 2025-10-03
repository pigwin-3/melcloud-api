# MELCloud API

A simple and intuitive Node.js client for the MELCloud API to control Mitsubishi air conditioning devices.

## Installation

```bash
npm install melcloud-api
```

## Quick Start

```javascript
const MELCloudAPI = require('melcloud-api');

const client = new MELCloudAPI('your-email@example.com', 'your-password');

// Get all devices
const devices = await client.getDevices();
console.log(devices);

// Get a specific device
const device = await client.getDevice(92663502);
console.log(device);

// Turn on a device
await client.turnOn(92663502);

// Set temperature
await client.setTemperature(92663502, 22);

// Set multiple parameters
await client.setDevice(92663502, {
    power: true,
    temperature: 22,
    mode: 'heat',
    fanSpeed: 3
});
```

## API Reference

### Constructor

```javascript
new MELCloudAPI(email, password, options)
```

**Parameters:**
- `email` (string): Your MELCloud account email
- `password` (string): Your MELCloud account password
- `options` (object, optional):
  - `language` (number): Language code (default: 0)
  - `appVersion` (string): App version (default: '1.34.13.0')

### Methods

#### `login()`

Authenticate with MELCloud. This is called automatically when needed.

```javascript
await client.login();
```

**Returns:** Promise<string> - Authentication context key

---

#### `getDevices()`

Get all devices associated with your account.

```javascript
const devices = await client.getDevices();
```

**Returns:** Promise<Array<DeviceInfo>> - Array of device objects

**Device Object:**
```javascript
{
    id: 92663502,              // Device ID
    index: 0,                  // Index in the list
    buildingId: 684834,        // Building ID
    name: "Living Room",       // Device name
    type: 0,                   // Device type
    power: true,               // Power state
    temperature: 22,           // Target temperature
    roomTemperature: 21.5,     // Current room temperature
    fanSpeed: "3",             // Fan speed ("auto", "1"-"5")
    mode: "heat",              // Operation mode
    vaneHorizontal: "auto",    // Horizontal vane position
    vaneVertical: "swing",     // Vertical vane position
    offline: false,            // Connection status
    lastCommunication: "2025-10-03T12:00:00Z"
}
```

---

#### `getDevice(deviceId, buildingId)`

Get detailed information about a specific device.

```javascript
const device = await client.getDevice(92663502);
// or with building ID
const device = await client.getDevice(92663502, 684834);
```

**Parameters:**
- `deviceId` (number): The device ID
- `buildingId` (number, optional): The building ID (fetched automatically if not provided)

**Returns:** Promise<DeviceInfo> - Device object

---

#### `setDevice(deviceId, params, buildingId)`

Set device parameters.

```javascript
await client.setDevice(92663502, {
    power: true,
    temperature: 22,
    mode: 'heat',
    fanSpeed: 3,
    vaneHorizontal: 'auto',
    vaneVertical: 'swing'
});
```

**Parameters:**
- `deviceId` (number): The device ID
- `params` (object): Parameters to set
  - `power` (boolean, optional): Turn device on/off
  - `temperature` (number, optional): Target temperature
  - `fanSpeed` (number|string, optional): Fan speed (0 or 'auto', 1-5)
  - `mode` (string, optional): Operation mode ('heat', 'dry', 'cold', 'cool', 'fan', 'auto')
  - `vaneHorizontal` (number|string, optional): Horizontal vane (0 or 'auto', 1-5, 12 or 'swing')
  - `vaneVertical` (number|string, optional): Vertical vane (0 or 'auto', 1-5, 7 or 'swing')
- `buildingId` (number, optional): The building ID

**Returns:** Promise<DeviceInfo> - Updated device state

---

#### `turnOn(deviceId, buildingId)`

Convenience method to turn a device on.

```javascript
await client.turnOn(92663502);
```

**Parameters:**
- `deviceId` (number): The device ID
- `buildingId` (number, optional): The building ID

**Returns:** Promise<DeviceInfo> - Updated device state

---

#### `turnOff(deviceId, buildingId)`

Convenience method to turn a device off.

```javascript
await client.turnOff(92663502);
```

**Parameters:**
- `deviceId` (number): The device ID
- `buildingId` (number, optional): The building ID

**Returns:** Promise<DeviceInfo> - Updated device state

---

#### `setTemperature(deviceId, temperature, buildingId)`

Convenience method to set the temperature.

```javascript
await client.setTemperature(92663502, 22);
```

**Parameters:**
- `deviceId` (number): The device ID
- `temperature` (number): Target temperature in Celsius
- `buildingId` (number, optional): The building ID

**Returns:** Promise<DeviceInfo> - Updated device state

---

## Examples

### List all devices

```javascript
const MELCloudAPI = require('melcloud-api');

const client = new MELCloudAPI('your-email@example.com', 'your-password');

(async () => {
    const devices = await client.getDevices();
    
    devices.forEach(device => {
        console.log(`${device.name} (ID: ${device.id})`);
        console.log(`  Power: ${device.power ? 'ON' : 'OFF'}`);
        console.log(`  Temperature: ${device.temperature}°C`);
        console.log(`  Room Temperature: ${device.roomTemperature}°C`);
        console.log(`  Mode: ${device.mode}`);
        console.log('');
    });
})();
```

### Control a device

```javascript
const MELCloudAPI = require('melcloud-api');

const client = new MELCloudAPI('your-email@example.com', 'your-password');
const DEVICE_ID = 92663502;

(async () => {
    // Turn on and set to heating mode
    await client.setDevice(DEVICE_ID, {
        power: true,
        mode: 'heat',
        temperature: 22,
        fanSpeed: 'auto'
    });
    
    console.log('Device configured!');
    
    // Check the status
    const device = await client.getDevice(DEVICE_ID);
    console.log(`Current temperature: ${device.roomTemperature}°C`);
    console.log(`Target temperature: ${device.temperature}°C`);
})();
```

### Express.js integration

```javascript
const express = require('express');
const MELCloudAPI = require('melcloud-api');

const app = express();
app.use(express.json());

const client = new MELCloudAPI('your-email@example.com', 'your-password');

// Get all devices
app.get('/devices', async (req, res) => {
    try {
        const devices = await client.getDevices();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get device status
app.get('/devices/:id', async (req, res) => {
    try {
        const device = await client.getDevice(parseInt(req.params.id));
        res.json(device);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Control device
app.post('/devices/:id', async (req, res) => {
    try {
        const device = await client.setDevice(parseInt(req.params.id), req.body);
        res.json(device);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## Error Handling

The library will automatically retry authentication if a session expires. Handle errors appropriately:

```javascript
try {
    await client.setDevice(deviceId, { temperature: 22 });
} catch (error) {
    console.error('Failed to set device:', error.message);
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This is an unofficial library and is not affiliated with Mitsubishi Electric. Use at your own risk.
