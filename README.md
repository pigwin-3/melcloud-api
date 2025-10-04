# MELCloud API

A comprehensive Node.js client for the MELCloud API supporting **Air Conditioners** and **Heat Pumps** with advanced features including energy monitoring, WiFi diagnostics, and robust error handling.

[![npm version](https://badge.fury.io/js/melcloud-api.svg)](https://badge.fury.io/js/melcloud-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

### **Device Support**
- **Air Conditioners (ATA)** - Complete control and monitoring
- **Heat Pumps (ATW)** - Advanced multi-zone control with hot water management
- **Auto-detection** - Automatically detects device types and capabilities

### **Advanced Control**
- **Multi-zone Heat Pumps** - Independent control of Zone 1 & Zone 2
- **Hot Water Priority** - Tank water temperature and priority mode control
- **Flow Temperature Control** - Heating and cooling flow temperatures
- **All Standard Functions** - Power, temperature, fan speed, vane positions, operation modes

### **Monitoring & Diagnostics**
- **Energy Reports** - Detailed power consumption and production data
- **WiFi Signal Strength** - Monitor device connectivity
- **Error Detection** - Comprehensive error codes and messages
- **Outdoor Temperature** - Environmental monitoring
- **Device Status** - Online/offline, communication timestamps

### **Reliability**
- **Auto-retry Logic** - Handles network issues and expired sessions
- **Exponential Backoff** - Smart retry timing to avoid server overload
- **Rate Limiting Support** - Respects MELCloud's rate limits
- **TypeScript Support** - Full type definitions included

---

## Installation

```bash
npm install melcloud-api
```

---

## Quick Start

```javascript
const MELCloudAPI = require('melcloud-api');

const client = new MELCloudAPI('your-email@example.com', 'your-password');

// Get all devices with enhanced info
const devices = await client.getDevices();
console.log('WiFi Signal:', devices[0].wifiSignalStrength);
console.log('Outdoor Temp:', devices[0].outdoorTemperature);
console.log('Has Error:', devices[0].hasError);

// Air conditioner control
await client.setDevice(deviceId, {
    power: true,
    temperature: 22,
    mode: 'heat',
    fanSpeed: 'auto'
});

// Heat pump control
await client.setHeatPumpDevice(deviceId, {
    power: true,
    forcedHotWaterMode: true,
    setTankWaterTemperature: 50,
    setTemperatureZone1: 21,
    setTemperatureZone2: 20
});

// Energy monitoring
const energyReport = await client.getEnergyReport(deviceId, '2024-01-01', '2024-01-31');
console.log('Total consumption:', energyReport.totalPowerConsumption, 'kWh');
```

---

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

---

## Device Discovery

### `getDevices()`
Get all devices with comprehensive information including error states, WiFi signal, and capabilities.

```javascript
const devices = await client.getDevices();
```

**Enhanced Device Object:**
```javascript
{
    // Basic info
    id: 92663502,
    name: "Living Room AC",
    type: 0, // 0=Air Conditioner, 1=Heat Pump
    buildingId: 684834,
    
    // Status
    power: true,
    offline: false,
    lastCommunication: "2024-10-03T12:00:00Z",
    nextCommunication: "2024-10-03T12:05:00Z",
    
    // Error handling  
    hasError: false,
    errorCode: 8000, // 8000 = No error
    errorMessages: "",
    
    // Connectivity
    wifiSignalStrength: -45, // dBm
    
    // Temperature
    temperature: 22,           // Target
    roomTemperature: 21.5,     // Current room
    outdoorTemperature: 15.2,  // Outside
    
    // Air conditioner specific
    fanSpeed: "auto",
    mode: "heat",
    vaneHorizontal: "auto",
    vaneVertical: "swing",
    actualFanSpeed: 3,
    numberOfFanSpeeds: 5,
    
    // Device capabilities
    canCool: true,
    canHeat: true,
    canDry: true,
    minTempHeat: 10,
    maxTempHeat: 31,
    
    // Heat pump specific (when type=1)
    hasZone2: true,
    roomTemperatureZone1: 21,
    roomTemperatureZone2: 20,
    tankWaterTemperature: 45,
    flowTemperature: 35,
    operationState: 1, // 0=Idle, 1=Heating Water, etc.
    // ... many more heat pump fields
}
```

### `getDevicesByType(type)`
Filter devices by type.

```javascript
const airConditioners = await client.getDevicesByType(0);
const heatPumps = await client.getDevicesByType('heat-pump');
```

### `getAirConditioners()` / `getHeatPumps()`
Convenience methods for specific device types.

```javascript
const acs = await client.getAirConditioners();
const hps = await client.getHeatPumps();
```

### `getDeviceStatus(deviceId)`
Get a quick status summary of a device.

```javascript
const status = await client.getDeviceStatus(deviceId);
console.log(status.type); // "Air Conditioner" or "Heat Pump"
console.log(status.online); // true/false
console.log(status.hasError); // true/false
```

---

## Air Conditioner Control

### `setDevice(deviceId, params, buildingId)`
Control air conditioning units with all standard parameters.

```javascript
await client.setDevice(deviceId, {
    power: true,
    temperature: 22,
    mode: 'heat', // 'heat', 'cool', 'dry', 'fan', 'auto'
    fanSpeed: 3,  // 'auto' or 1-5
    vaneHorizontal: 'swing', // 'auto', 1-5, 'swing'
    vaneVertical: 'auto'     // 'auto', 1-5, 'swing'
});
```

**Mode Aliases Supported:**
- Heat: `'heat'`, `'hot'`, `'h'`, `1`
- Cool: `'cool'`, `'cold'`, `'c'`, `3`  
- Dry: `'dry'`, `'d'`, `2`
- Fan: `'fan'`, `'air'`, `'f'`, `7`
- Auto: `'auto'`, `'a'`, `8`

### Convenience Methods

```javascript
// Power control
await client.turnOn(deviceId);
await client.turnOff(deviceId);

// Temperature
await client.setTemperature(deviceId, 22);
```

---

## Heat Pump Control

### `setHeatPumpDevice(deviceId, params, buildingId)`
Advanced control for heat pump (ATW) devices with multi-zone and hot water support.

```javascript
await client.setHeatPumpDevice(deviceId, {
    power: true,
    
    // Hot water control
    forcedHotWaterMode: true,        // Priority mode
    setTankWaterTemperature: 50,     // Tank temperature
    
    // Zone control
    operationModeZone1: 0,           // 0=HEATTHERMOSTAT, 1=HEATFLOW, etc.
    operationModeZone2: 0,           // (if hasZone2)
    setTemperatureZone1: 21,         // Zone 1 target temp
    setTemperatureZone2: 20,         // Zone 2 target temp
    
    // Flow temperatures
    setHeatFlowTemperatureZone1: 35, // Heat flow temp Zone 1
    setHeatFlowTemperatureZone2: 35, // Heat flow temp Zone 2  
    setCoolFlowTemperatureZone1: 18, // Cool flow temp Zone 1
    setCoolFlowTemperatureZone2: 18  // Cool flow temp Zone 2
});
```

**Operation Modes:**
- `0` = HEATTHERMOSTAT (room thermostat heating)
- `1` = HEATFLOW (heat flow temperature control)
- `2` = CURVE (heating curve control)  
- `3` = COOLTHERMOSTAT (room thermostat cooling)
- `4` = COOLFLOW (cool flow temperature control)

### Heat Pump Convenience Methods

```javascript
// Hot water control
await client.setHotWaterMode(deviceId, true);
await client.setTankWaterTemperature(deviceId, 50);

// Zone temperature control
await client.setZoneTemperature(deviceId, 1, 21); // Zone 1 to 21°C
await client.setZoneTemperature(deviceId, 2, 20); // Zone 2 to 20°C
```

---

## Energy Monitoring

### `getEnergyReport(deviceId, fromDate, toDate, buildingId)`
Get detailed energy consumption and production data.

```javascript
const report = await client.getEnergyReport(
    deviceId, 
    '2024-01-01',  // YYYY-MM-DD format
    '2024-01-31'
);

console.log('Report for device:', report.deviceId);
console.log('Period:', report.fromDate, 'to', report.toDate);
console.log('Total runtime:', report.totalMinutes, 'minutes');
console.log('Total consumption:', report.totalPowerConsumption, 'kWh');

// Air conditioner breakdown
console.log('Heating consumption:', report.totalPowerConsumptionHeat, 'kWh');
console.log('Cooling consumption:', report.totalPowerConsumptionCool, 'kWh');
console.log('Dry mode consumption:', report.totalPowerConsumptionDry, 'kWh');

// Heat pump breakdown  
console.log('Hot water consumption:', report.totalPowerConsumptionHotWater, 'kWh');
console.log('Heating production:', report.totalPowerProductionHeating, 'kWh');
console.log('Raw data:', report.rawData); // Full MELCloud response
```

---

## Advanced Usage

### Error Handling & Diagnostics

```javascript
try {
    const device = await client.getDevice(deviceId);
    
    // Check device health
    if (device.hasError) {
        console.error('Device error:', device.errorCode, device.errorMessages);
    }
    
    // Check connectivity
    if (device.offline) {
        console.warn('Device is offline');
        console.log('Last seen:', device.lastCommunication);
    }
    
    // Check WiFi signal
    if (device.wifiSignalStrength < -70) {
        console.warn('Weak WiFi signal:', device.wifiSignalStrength, 'dBm');
    }
    
} catch (error) {
    console.error('API Error:', error.message);
}
```

### Device Type Detection

```javascript
const devices = await client.getDevices();

devices.forEach(device => {
    if (device.type === 0) {
        console.log(`${device.name} is an Air Conditioner`);
        console.log('Capabilities:', {
            canCool: device.canCool,
            canHeat: device.canHeat,
            canDry: device.canDry
        });
    } else if (device.type === 1) {
        console.log(`${device.name} is a Heat Pump`);
        console.log('Zones:', device.hasZone2 ? '2 zones' : '1 zone');
        console.log('Tank temp:', device.tankWaterTemperature, '°C');
    }
});
```

### Express.js REST API

```javascript
const express = require('express');
const MELCloudAPI = require('melcloud-api');

const app = express();
app.use(express.json());

const client = new MELCloudAPI(process.env.MELCLOUD_EMAIL, process.env.MELCLOUD_PASSWORD);

// Get all devices with enhanced info
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await client.getDevices();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Control heat pump
app.post('/api/devices/:id/heatpump', async (req, res) => {
    try {
        const device = await client.setHeatPumpDevice(parseInt(req.params.id), req.body);
        res.json(device);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get energy report
app.get('/api/devices/:id/energy', async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const report = await client.getEnergyReport(parseInt(req.params.id), fromDate, toDate);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('MELCloud API Server running on port 3000'));
```

---

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import MELCloudAPI, { DeviceInfo, SetDeviceParams, SetHeatPumpParams } from 'melcloud-api';

const client = new MELCloudAPI('email', 'password');

// Type-safe device control
const params: SetDeviceParams = {
    power: true,
    temperature: 22,
    mode: 'heat'
};

const device: DeviceInfo = await client.setDevice(deviceId, params);

// Heat pump control with full typing
const hpParams: SetHeatPumpParams = {
    forcedHotWaterMode: true,
    setTankWaterTemperature: 50
};

await client.setHeatPumpDevice(deviceId, hpParams);
```

---

## Error Codes Reference

| Code | Meaning |
|------|---------|
| 8000 | No error (normal operation) |
| Other | Various device-specific error codes - check `errorMessages` field |

Common error scenarios:
- **Device offline**: `offline: true`
- **Communication issues**: Old `lastCommunication` timestamp
- **WiFi problems**: Low `wifiSignalStrength` (< -70 dBm)
- **Heat pump errors**: Check `hasError` and `errorCode`

---

## Features

| Feature | melcloud-api |
|---------|--------------|
| Air Conditioner Support | Full |
| Heat Pump Support | Complete |
| Energy Monitoring | Yes |
| WiFi Diagnostics | Yes |
| Error Handling | Advanced |
| Auto-retry Logic | Smart |
| TypeScript Support | Full |
| Multi-zone Heat Pumps | Yes |
| Hot Water Control | Yes |

---

## License

MIT License - see LICENSE file for details.

---

## ⚠️ Disclaimer

This is an **unofficial** library and is not affiliated with Mitsubishi Electric. Use at your own risk.

- **Rate Limiting**: Be respectful of MELCloud's servers - avoid excessive requests
- **Security**: Store credentials securely and never commit them to version control
- **Compatibility**: Tested with MELCloud app version 1.34.13.0

---

**If this library helps you, please consider giving it a star on GitHub! My ego would like that.**
