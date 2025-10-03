const axios = require('axios');

class MELCloudAPI {
    constructor(email, password, options = {}) {
        this.email = email;
        this.password = password;
        this.language = options.language || 0;
        this.appVersion = options.appVersion || '1.34.13.0';
        this.contextKey = null;
        this.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client';
    }

    /**
     * Login to MELCloud and obtain auth token
     * @returns {Promise<string>} Context key for authenticated requests
     */
    async login() {
        const credentials = {
            Email: this.email,
            Password: this.password,
            Language: this.language,
            AppVersion: this.appVersion,
            Persist: false,
            CaptchaResponse: null,
        };

        try {
            const response = await axios.post(
                `${this.baseURL}/Login/ClientLogin2`,
                credentials,
                { headers: { 'Content-Type': 'application/json' } }
            );
            
            this.contextKey = response.data.LoginData.ContextKey;
            return this.contextKey;
        } catch (error) {
            throw new Error(`MELCloud login failed: ${error.message}`);
        }
    }

    /**
     * Ensure we gots a valid auth token
     * @private
     */
    async _ensureAuthenticated() {
        if (!this.contextKey) {
            await this.login();
        }
    }

    /**
     * Get all devices in account
     * @returns {Promise<Array>} Array of all devices with their deets
     */
    async getDevices() {
        await this._ensureAuthenticated();

        try {
            const response = await axios.get(
                `${this.baseURL}/User/ListDevices`,
                { headers: { 'X-MitsContextKey': this.contextKey } }
            );

            const devices = [];
            let index = 0;

            response.data.forEach(building => {
                building.Structure.Floors.forEach(floor => {
                    floor.Areas.forEach(area => {
                        area.Devices.forEach(dev => {
                            devices.push({
                                id: dev.DeviceID,
                                index: index++,
                                buildingId: building.ID,
                                name: dev.DeviceName,
                                type: dev.Device.DeviceType,
                                ...this._parseDeviceData(dev.Device)
                            });
                        });
                    });
                });
            });

            return devices;
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.contextKey = null;
                return this.getDevices(); // Retry after clearing token
            }
            throw new Error(`Failed to fetch devices: ${error.message}`);
        }
    }

    /**
     * Get detailed information about a specific device
     * @param {number} deviceId - The device ID
     * @param {number} buildingId - The building ID 
     * @returns {Promise<Object>} Device deets
     */
    async getDevice(deviceId, buildingId = null) {
        await this._ensureAuthenticated();

        // If buildingId not provided, fetch it from device list
        if (!buildingId) {
            const devices = await this.getDevices();
            const device = devices.find(d => d.id === deviceId);
            if (!device) {
                throw new Error(`Device with ID ${deviceId} not found`);
            }
            buildingId = device.buildingId;
        }

        try {
            const response = await axios.get(
                `${this.baseURL}/Device/Get?id=${deviceId}&buildingID=${buildingId}`,
                { headers: { 'X-MitsContextKey': this.contextKey } }
            );

            return {
                id: deviceId,
                buildingId: buildingId,
                ...this._parseDeviceData(response.data)
            };
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.contextKey = null;
                return this.getDevice(deviceId, buildingId);
            }
            throw new Error(`Failed to fetch device: ${error.message}`);
        }
    }

    /**
     * Set device parameters
     * @param {number} deviceId - The device ID
     * @param {Object} params - Parameters to set
     * @param {boolean} [params.power] - Power on/off
     * @param {number} [params.temperature] - Target temperature
     * @param {number|string} [params.fanSpeed] - Fan speed (0='auto', 1-5)
     * @param {string} [params.mode] - Operation mode ('heat', 'dry', 'cold', 'fan', 'auto')
     * @param {number|string} [params.vaneHorizontal] - Horizontal vane position (0='auto', 1-5, 12='swing')
     * @param {number|string} [params.vaneVertical] - Vertical vane position (0='auto', 1-5, 7='swing')
     * @param {number} buildingId - The building ID (optional, will fetch if not provided)
     * @returns {Promise<Object>} Updated device state
     * info is from the device i got no idea if this works for other devices
     */
    async setDevice(deviceId, params, buildingId = null) {
        await this._ensureAuthenticated();

        // Get current device status
        const currentStatus = await this.getDevice(deviceId, buildingId);
        buildingId = currentStatus.buildingId;

        // Build payload with current values
        const payload = {
            DeviceID: deviceId,
            DeviceType: 0,
            Power: currentStatus.power,
            SetTemperature: currentStatus.temperature,
            SetFanSpeed: currentStatus.fanSpeedRaw,
            OperationMode: currentStatus.modeRaw,
            VaneHorizontal: currentStatus.vaneHorizontalRaw,
            VaneVertical: currentStatus.vaneVerticalRaw,
            EffectiveFlags: 0
        };

        // Operation modes mapping
        const modeMappings = {
            heat: 1,
            hot: 1, // Alias
            h: 1, // Alias
            dry: 2,
            d: 2, // Alias
            cold: 3,
            cool: 3, // Alias
            c: 3, // Alias
            fan: 7,
            air: 7, // Alias
            f: 7, // Alias
            auto: 8,
            a: 8 // Alias
        };

        // Vane mappings
        const vaneHorizontalMappings = { auto: 0, swing: 12 };
        const vaneVerticalMappings = { auto: 0, swing: 7 };

        // EffectiveFlags mapping
        const flagMappings = {
            power: 1,
            operationmode: 2,
            settemperature: 4,
            setfanspeed: 8,
            vanevertical: 16,
            // idk if anything is here might check later
            vanehorizontal: 256
        };

        // Update parameters
        if (params.power !== undefined) {
            payload.Power = Boolean(params.power);
            payload.EffectiveFlags += flagMappings.power;
        }

        if (params.temperature !== undefined) {
            payload.SetTemperature = parseFloat(params.temperature);
            payload.EffectiveFlags += flagMappings.settemperature;
        }

        if (params.fanSpeed !== undefined) {
            payload.SetFanSpeed = params.fanSpeed === 'auto' ? 0 : parseInt(params.fanSpeed, 10);
            payload.EffectiveFlags += flagMappings.setfanspeed;
        }

        if (params.mode !== undefined) {
            const mode = typeof params.mode === 'string' ? params.mode.toLowerCase() : params.mode;
            payload.OperationMode = modeMappings[mode] || parseInt(mode, 10);
            payload.EffectiveFlags += flagMappings.operationmode;
        }

        if (params.vaneHorizontal !== undefined) {
            const vane = typeof params.vaneHorizontal === 'string' ? params.vaneHorizontal.toLowerCase() : params.vaneHorizontal;
            payload.VaneHorizontal = vaneHorizontalMappings[vane] !== undefined
                ? vaneHorizontalMappings[vane]
                : parseInt(vane, 10);
            payload.EffectiveFlags += flagMappings.vanehorizontal;
        }

        if (params.vaneVertical !== undefined) {
            const vane = typeof params.vaneVertical === 'string' ? params.vaneVertical.toLowerCase() : params.vaneVertical;
            payload.VaneVertical = vaneVerticalMappings[vane] !== undefined
                ? vaneVerticalMappings[vane]
                : parseInt(vane, 10);
            payload.EffectiveFlags += flagMappings.vanevertical;
        }

        if (payload.EffectiveFlags === 0) {
            throw new Error('No valid parameters provided to set');
        }

        try {
            await axios.post(
                `${this.baseURL}/Device/SetAta`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-MitsContextKey': this.contextKey
                    }
                }
            );

            // Return updated device state after a brief delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            return this.getDevice(deviceId, buildingId);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.contextKey = null;
                return this.setDevice(deviceId, params, buildingId);
            }
            throw new Error(`Failed to set device parameters: ${error.message}`);
        }
    }

    /**
     * Parse raw device data into a friendly format
     * @private
     */
    _parseDeviceData(deviceData) {
        const operationModes = { 1: 'heat', 2: 'dry', 3: 'cold', 7: 'fan', 8: 'auto' };
        const fanSpeeds = { 0: 'auto', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
        const vanePositions = {
            0: 'auto',
            1: '1',
            2: '2',
            3: '3',
            4: '4',
            5: '5',
            7: 'swing',
            12: 'swing'
        };

        return {
            power: deviceData.Power,
            temperature: deviceData.SetTemperature,
            roomTemperature: deviceData.RoomTemperature,
            fanSpeed: fanSpeeds[deviceData.SetFanSpeed] || fanSpeeds[deviceData.FanSpeed] || 'unknown',
            fanSpeedRaw: deviceData.SetFanSpeed || deviceData.FanSpeed,
            mode: operationModes[deviceData.OperationMode] || 'unknown',
            modeRaw: deviceData.OperationMode,
            vaneHorizontal: vanePositions[deviceData.VaneHorizontalDirection] || 'unknown',
            vaneHorizontalRaw: deviceData.VaneHorizontalDirection,
            vaneVertical: vanePositions[deviceData.VaneVerticalDirection] || 'unknown',
            vaneVerticalRaw: deviceData.VaneVerticalDirection,
            offline: deviceData.Offline || false,
            lastCommunication: deviceData.LastCommunication,
        };
    }

    /**
     * Convenience method to turn a device on
     * @param {number} deviceId - The device ID
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Updated device state
     */
    async turnOn(deviceId, buildingId = null) {
        return this.setDevice(deviceId, { power: true }, buildingId);
    }

    /**
     * Convenience method to turn a device off
     * @param {number} deviceId - The device ID
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Updated device state
     */
    async turnOff(deviceId, buildingId = null) {
        return this.setDevice(deviceId, { power: false }, buildingId);
    }

    /**
     * Convenience method to set temperature
     * @param {number} deviceId - The device ID
     * @param {number} temperature - Target temperature
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Updated device state
     */
    async setTemperature(deviceId, temperature, buildingId = null) {
        return this.setDevice(deviceId, { temperature }, buildingId);
    }
}

module.exports = MELCloudAPI;
