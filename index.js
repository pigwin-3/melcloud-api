// Hand decoded from MELCloud app requests and responses
// AI used to write all comments and some code parts
const axios = require('axios');

class MELCloudAPI {
    constructor(email, password, options = {}) {
        this.email = email;
        this.password = password;
        this.language = options.language || 0;
        this.appVersion = options.appVersion || '1.34.13.0';
        this.contextKey = null;
        this.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client';
        this.maxRetries = 2;
    }

    /**
     * Login to MELCloud and obtain auth token
     * @returns {Promise<string>} Context key for authenticated requests
     */
    async login() {
        return this._retryRequest(async () => {
            const credentials = {
                Email: this.email,
                Password: this.password,
                Language: this.language,
                AppVersion: this.appVersion,
                Persist: false,
                CaptchaResponse: null,
            };

            const response = await axios.post(
                `${this.baseURL}/Login/ClientLogin2`,
                credentials,
                { headers: { 'Content-Type': 'application/json' } }
            );
            
            this.contextKey = response.data.LoginData.ContextKey;
            return this.contextKey;
        });
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
     * Helper method to retry requests with exponential backoff
     * @private
     */
    async _retryRequest(requestFn, retries = 0) {
        try {
            return await requestFn();
        } catch (error) {
            const shouldRetry = this._shouldRetryError(error);
            
            if (shouldRetry && retries < this.maxRetries) {
                // Clear context key if it's an auth error
                if (error.response && error.response.status === 401) {
                    this.contextKey = null;
                }
                
                // Exponential backoff: 1s, 2s, 4s...
                const delay = Math.pow(2, retries) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                
                return this._retryRequest(requestFn, retries + 1);
            }
            
            throw error;
        }
    }

    /**
     * Determine if an error should trigger a retry
     * @private
     */
    _shouldRetryError(error) {
        // Retry on network errors, timeouts, and certain HTTP status codes
        if (!error.response) {
            // Network error, timeout, etc.
            return true;
        }
        
        const status = error.response.status;
        // Retry on auth errors, server errors, and rate limiting
        return status === 401 || status === 429 || (status >= 500 && status < 600);
    }

    /**
     * Get all devices in account
     * @returns {Promise<Array>} Array of all devices with their deets
     */
    async getDevices() {
        return this._retryRequest(async () => {
            await this._ensureAuthenticated();

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
        });
    }

    /**
     * Get detailed information about a specific device
     * @param {number} deviceId - The device ID
     * @param {number} buildingId - The building ID 
     * @returns {Promise<Object>} Device deets
     */
    async getDevice(deviceId, buildingId = null) {
        return this._retryRequest(async () => {
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

            const response = await axios.get(
                `${this.baseURL}/Device/Get?id=${deviceId}&buildingID=${buildingId}`,
                { headers: { 'X-MitsContextKey': this.contextKey } }
            );

            return {
                id: deviceId,
                buildingId: buildingId,
                ...this._parseDeviceData(response.data)
            };
        });
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
        return this._retryRequest(async () => {
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
                1: 1, // Alias
                dry: 2,
                d: 2, // Alias
                2: 2, // Alias
                cold: 3,
                cool: 3, // Alias
                c: 3, // Alias
                3: 3, // Alias
                4: 4, // Unused for my devices, idk about others tho so i added it
                5: 5, // Unused for my devices, idk about others tho so i added it
                6: 6, // Unused for my devices, idk about others tho so i added it
                fan: 7,
                air: 7, // Alias
                f: 7, // Alias
                7: 7, // Alias
                auto: 8,
                a: 8, // Alias
                8: 8 // Alias
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
        });
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
            nextCommunication: deviceData.NextCommunication,
            
            // Additional device states
            wifiSignalStrength: deviceData.WifiSignalStrength,
            outdoorTemperature: deviceData.OutdoorTemperature,
            actualFanSpeed: deviceData.ActualFanSpeed,
            numberOfFanSpeeds: deviceData.NumberOfFanSpeeds,
            
            // Error handling
            hasError: deviceData.HasError || false,
            errorCode: deviceData.ErrorCode || 8000,
            errorMessages: deviceData.ErrorMessage || '',
            
            // Device capabilities
            canCool: deviceData.CanCool,
            canHeat: deviceData.CanHeat,
            canDry: deviceData.CanDry,
            
            // Temperature limits
            minTempCoolDry: deviceData.MinTempCoolDry,
            maxTempCoolDry: deviceData.MaxTempCoolDry,
            minTempHeat: deviceData.MinTempHeat,
            maxTempHeat: deviceData.MaxTempHeat,
            minTempAuto: deviceData.MinTempAutomatic || deviceData.MinTempAuto,
            maxTempAuto: deviceData.MaxTempAutomatic || deviceData.MaxTempAuto,
            
            // Heat pump specific (ATW devices)
            hasZone2: deviceData.HasZone2,
            roomTemperatureZone1: deviceData.RoomTemperatureZone1,
            roomTemperatureZone2: deviceData.RoomTemperatureZone2,
            tankWaterTemperature: deviceData.TankWaterTemperature,
            mixingTankWaterTemperature: deviceData.MixingTankWaterTemperature,
            flowTemperature: deviceData.FlowTemperature,
            flowTemperatureZone1: deviceData.FlowTemperatureZone1,
            flowTemperatureZone2: deviceData.FlowTemperatureZone2,
            flowTemperatureBoiler: deviceData.FlowTemperatureBoiler,
            returnTemperature: deviceData.ReturnTemperature,
            returnTemperatureZone1: deviceData.ReturnTemperatureZone1,
            returnTemperatureZone2: deviceData.ReturnTemperatureZone2,
            returnTemperatureBoiler: deviceData.ReturnTemperatureBoiler,
            condensingTemperature: deviceData.CondensingTemperature,
            heatPumpFrequency: deviceData.HeatPumpFrequency,
            operationState: deviceData.OperationState,
            
            // Heat pump control
            setTankWaterTemperature: deviceData.SetTankWaterTemperature,
            setTemperatureZone1: deviceData.SetTemperatureZone1,
            setTemperatureZone2: deviceData.SetTemperatureZone2,
            setHeatFlowTemperatureZone1: deviceData.SetHeatFlowTemperatureZone1,
            setHeatFlowTemperatureZone2: deviceData.SetHeatFlowTemperatureZone2,
            setCoolFlowTemperatureZone1: deviceData.SetCoolFlowTemperatureZone1,
            setCoolFlowTemperatureZone2: deviceData.SetCoolFlowTemperatureZone2,
            forcedHotWaterMode: deviceData.ForcedHotWaterMode,
            operationModeZone1: deviceData.OperationModeZone1,
            operationModeZone2: deviceData.OperationModeZone2,
        };
    }

    /**
     * Set heat pump (ATW) device parameters
     * @param {number} deviceId - The device ID
     * @param {Object} params - Parameters to set
     * @param {boolean} [params.power] - Power on/off
     * @param {boolean} [params.forcedHotWaterMode] - Hot water priority mode
     * @param {number} [params.operationModeZone1] - Zone 1 operation mode (0=HEATTHERMOSTAT, 1=HEATFLOW, 2=CURVE, 3=COOLTHERMOSTAT, 4=COOLFLOW)
     * @param {number} [params.operationModeZone2] - Zone 2 operation mode (if device has zone 2)
     * @param {number} [params.setTankWaterTemperature] - Tank water temperature
     * @param {number} [params.setTemperatureZone1] - Zone 1 temperature
     * @param {number} [params.setTemperatureZone2] - Zone 2 temperature
     * @param {number} [params.setHeatFlowTemperatureZone1] - Zone 1 heat flow temperature
     * @param {number} [params.setHeatFlowTemperatureZone2] - Zone 2 heat flow temperature
     * @param {number} [params.setCoolFlowTemperatureZone1] - Zone 1 cool flow temperature
     * @param {number} [params.setCoolFlowTemperatureZone2] - Zone 2 cool flow temperature
     * @param {number} buildingId - The building ID (optional, will fetch if not provided)
     * @returns {Promise<Object>} Updated device state
     */
    async setHeatPumpDevice(deviceId, params, buildingId = null) {
        return this._retryRequest(async () => {
            await this._ensureAuthenticated();

            // Get current device status
            const currentStatus = await this.getDevice(deviceId, buildingId);
            buildingId = currentStatus.buildingId;

            if (currentStatus.type !== 1) {
                throw new Error('Device is not a heat pump (ATW device)');
            }

            // Build payload with current values
            const payload = {
                DeviceID: deviceId,
                DeviceType: 1, // Heat pump type
                Power: currentStatus.power,
                ForcedHotWaterMode: currentStatus.forcedHotWaterMode || false,
                OperationModeZone1: currentStatus.operationModeZone1 || 0,
                OperationModeZone2: currentStatus.operationModeZone2 || 0,
                SetTankWaterTemperature: currentStatus.setTankWaterTemperature || 40,
                SetTemperatureZone1: currentStatus.setTemperatureZone1 || 20,
                SetTemperatureZone2: currentStatus.setTemperatureZone2 || 20,
                SetHeatFlowTemperatureZone1: currentStatus.setHeatFlowTemperatureZone1 || 35,
                SetHeatFlowTemperatureZone2: currentStatus.setHeatFlowTemperatureZone2 || 35,
                SetCoolFlowTemperatureZone1: currentStatus.setCoolFlowTemperatureZone1 || 18,
                SetCoolFlowTemperatureZone2: currentStatus.setCoolFlowTemperatureZone2 || 18,
                EffectiveFlags: 0
            };

            // EffectiveFlags mapping for ATW devices
            const atwFlagMappings = {
                power: 1,
                forcedHotWaterMode: 2,
                operationModeZone1: 4,
                operationModeZone2: 8,
                setTankWaterTemperature: 16,
                setTemperatureZone1: 32,
                setTemperatureZone2: 64,
                setHeatFlowTemperatureZone1: 128,
                setHeatFlowTemperatureZone2: 256,
                setCoolFlowTemperatureZone1: 512,
                setCoolFlowTemperatureZone2: 1024
            };

            // Update parameters
            if (params.power !== undefined) {
                payload.Power = Boolean(params.power);
                payload.EffectiveFlags += atwFlagMappings.power;
            }

            if (params.forcedHotWaterMode !== undefined) {
                payload.ForcedHotWaterMode = Boolean(params.forcedHotWaterMode);
                payload.EffectiveFlags += atwFlagMappings.forcedHotWaterMode;
            }

            if (params.operationModeZone1 !== undefined) {
                payload.OperationModeZone1 = parseInt(params.operationModeZone1, 10);
                payload.EffectiveFlags += atwFlagMappings.operationModeZone1;
            }

            if (params.operationModeZone2 !== undefined) {
                if (!currentStatus.hasZone2) {
                    throw new Error('Device does not have Zone 2');
                }
                payload.OperationModeZone2 = parseInt(params.operationModeZone2, 10);
                payload.EffectiveFlags += atwFlagMappings.operationModeZone2;
            }

            if (params.setTankWaterTemperature !== undefined) {
                payload.SetTankWaterTemperature = parseFloat(params.setTankWaterTemperature);
                payload.EffectiveFlags += atwFlagMappings.setTankWaterTemperature;
            }

            if (params.setTemperatureZone1 !== undefined) {
                payload.SetTemperatureZone1 = parseFloat(params.setTemperatureZone1);
                payload.EffectiveFlags += atwFlagMappings.setTemperatureZone1;
            }

            if (params.setTemperatureZone2 !== undefined) {
                if (!currentStatus.hasZone2) {
                    throw new Error('Device does not have Zone 2');
                }
                payload.SetTemperatureZone2 = parseFloat(params.setTemperatureZone2);
                payload.EffectiveFlags += atwFlagMappings.setTemperatureZone2;
            }

            if (params.setHeatFlowTemperatureZone1 !== undefined) {
                payload.SetHeatFlowTemperatureZone1 = parseFloat(params.setHeatFlowTemperatureZone1);
                payload.EffectiveFlags += atwFlagMappings.setHeatFlowTemperatureZone1;
            }

            if (params.setHeatFlowTemperatureZone2 !== undefined) {
                if (!currentStatus.hasZone2) {
                    throw new Error('Device does not have Zone 2');
                }
                payload.SetHeatFlowTemperatureZone2 = parseFloat(params.setHeatFlowTemperatureZone2);
                payload.EffectiveFlags += atwFlagMappings.setHeatFlowTemperatureZone2;
            }

            if (params.setCoolFlowTemperatureZone1 !== undefined) {
                payload.SetCoolFlowTemperatureZone1 = parseFloat(params.setCoolFlowTemperatureZone1);
                payload.EffectiveFlags += atwFlagMappings.setCoolFlowTemperatureZone1;
            }

            if (params.setCoolFlowTemperatureZone2 !== undefined) {
                if (!currentStatus.hasZone2) {
                    throw new Error('Device does not have Zone 2');
                }
                payload.SetCoolFlowTemperatureZone2 = parseFloat(params.setCoolFlowTemperatureZone2);
                payload.EffectiveFlags += atwFlagMappings.setCoolFlowTemperatureZone2;
            }

            if (payload.EffectiveFlags === 0) {
                throw new Error('No valid parameters provided to set');
            }

            await axios.post(
                `${this.baseURL}/Device/SetAtw`, // Different endpoint for heat pumps
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
        });
    }

    /**
     * Get energy consumption report for a device
     * @param {number} deviceId - The device ID
     * @param {string} fromDate - Start date (YYYY-MM-DD format)
     * @param {string} toDate - End date (YYYY-MM-DD format)
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Energy consumption data
     */
    async getEnergyReport(deviceId, fromDate, toDate, buildingId = null) {
        return this._retryRequest(async () => {
            await this._ensureAuthenticated();

            if (!buildingId) {
                const devices = await this.getDevices();
                const device = devices.find(d => d.id === deviceId);
                if (!device) {
                    throw new Error(`Device with ID ${deviceId} not found`);
                }
                buildingId = device.buildingId;
            }

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
                throw new Error('Date format must be YYYY-MM-DD');
            }

            const response = await axios.post(
                `${this.baseURL}/EnergyCost/Report`,
                {
                    DeviceID: deviceId,
                    FromDate: fromDate,
                    ToDate: toDate,
                    UseCurrency: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-MitsContextKey': this.contextKey
                    }
                }
            );

            return {
                deviceId: deviceId,
                fromDate: fromDate,
                toDate: toDate,
                totalMinutes: response.data.TotalMinutes || 0,
                totalPowerConsumption: response.data.TotalPowerConsumption || 0,
                totalPowerProduction: response.data.TotalPowerProduction || 0,
                // Air conditioning specific
                totalPowerConsumptionAuto: response.data.TotalPowerConsumptionAuto || 0,
                totalPowerConsumptionHeat: response.data.TotalPowerConsumptionHeat || 0,
                totalPowerConsumptionCool: response.data.TotalPowerConsumptionCool || 0,
                totalPowerConsumptionDry: response.data.TotalPowerConsumptionDry || 0,
                totalPowerConsumptionVent: response.data.TotalPowerConsumptionVent || 0,
                // Heat pump specific
                totalPowerConsumptionHeating: response.data.TotalHeatingConsumed || 0,
                totalPowerConsumptionCooling: response.data.TotalCoolingConsumed || 0,
                totalPowerConsumptionHotWater: response.data.TotalHotWaterConsumed || 0,
                totalPowerProductionHeating: response.data.TotalHeatingProduced || 0,
                totalPowerProductionCooling: response.data.TotalCoolingProduced || 0,
                totalPowerProductionHotWater: response.data.TotalHotWaterProduced || 0,
                rawData: response.data
            };
        });
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

    /**
     * Convenience method to set hot water priority mode for heat pumps
     * @param {number} deviceId - The device ID
     * @param {boolean} enabled - Enable/disable hot water priority
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Updated device state
     */
    async setHotWaterMode(deviceId, enabled, buildingId = null) {
        return this.setHeatPumpDevice(deviceId, { forcedHotWaterMode: enabled }, buildingId);
    }

    /**
     * Convenience method to set tank water temperature for heat pumps
     * @param {number} deviceId - The device ID
     * @param {number} temperature - Tank water temperature
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Updated device state
     */
    async setTankWaterTemperature(deviceId, temperature, buildingId = null) {
        return this.setHeatPumpDevice(deviceId, { setTankWaterTemperature: temperature }, buildingId);
    }

    /**
     * Convenience method to set zone temperature for heat pumps
     * @param {number} deviceId - The device ID
     * @param {number} zone - Zone number (1 or 2)
     * @param {number} temperature - Target temperature
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Updated device state
     */
    async setZoneTemperature(deviceId, zone, temperature, buildingId = null) {
        if (zone === 1) {
            return this.setHeatPumpDevice(deviceId, { setTemperatureZone1: temperature }, buildingId);
        } else if (zone === 2) {
            return this.setHeatPumpDevice(deviceId, { setTemperatureZone2: temperature }, buildingId);
        } else {
            throw new Error('Zone must be 1 or 2');
        }
    }

    /**
     * Check if device is online and get status summary
     * @param {number} deviceId - The device ID
     * @param {number} buildingId - The building ID (optional)
     * @returns {Promise<Object>} Device status summary
     */
    async getDeviceStatus(deviceId, buildingId = null) {
        const device = await this.getDevice(deviceId, buildingId);
        
        return {
            id: device.id,
            name: device.name,
            type: device.type === 0 ? 'Air Conditioner' : device.type === 1 ? 'Heat Pump' : 'Unknown',
            online: !device.offline,
            hasError: device.hasError,
            errorCode: device.errorCode,
            errorMessages: device.errorMessages,
            power: device.power,
            lastCommunication: device.lastCommunication,
            wifiSignalStrength: device.wifiSignalStrength,
            // Temperature info
            roomTemperature: device.roomTemperature,
            outdoorTemperature: device.outdoorTemperature,
            targetTemperature: device.temperature,
            // Device capabilities
            canCool: device.canCool,
            canHeat: device.canHeat,
            canDry: device.canDry,
            // Heat pump specific
            hasZone2: device.hasZone2,
            tankWaterTemperature: device.tankWaterTemperature,
            operationState: device.operationState
        };
    }

    /**
     * Get devices by type
     * @param {number|string} deviceType - Device type (0='air-conditioner', 1='heat-pump') 
     * @returns {Promise<Array>} Array of devices of specified type
     */
    async getDevicesByType(deviceType) {
        const devices = await this.getDevices();
        const typeFilter = typeof deviceType === 'string' ? 
            (deviceType === 'air-conditioner' ? 0 : deviceType === 'heat-pump' ? 1 : -1) : 
            deviceType;
        
        return devices.filter(device => device.type === typeFilter);
    }

    /**
     * Get all air conditioning units
     * @returns {Promise<Array>} Array of air conditioning devices
     */
    async getAirConditioners() {
        return this.getDevicesByType(0);
    }

    /**
     * Get all heat pump units
     * @returns {Promise<Array>} Array of heat pump devices
     */
    async getHeatPumps() {
        return this.getDevicesByType(1);
    }
}

module.exports = MELCloudAPI;
