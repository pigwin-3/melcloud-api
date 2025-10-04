// TypeScript definitions for melcloud-api - AI made
declare module 'melcloud-api' {
    export interface MELCloudOptions {
        language?: number;
        appVersion?: string;
    }

    export interface DeviceInfo {
        id: number;
        index: number;
        buildingId: number;
        name: string;
        type: number;
        power: boolean;
        temperature: number;
        roomTemperature: number;
        fanSpeed: string;
        fanSpeedRaw: number;
        mode: string;
        modeRaw: number;
        vaneHorizontal: string;
        vaneHorizontalRaw: number;
        vaneVertical: string;
        vaneVerticalRaw: number;
        offline: boolean;
        lastCommunication: string;
        nextCommunication?: string;
        
        // Additional device states
        wifiSignalStrength?: number;
        outdoorTemperature?: number;
        actualFanSpeed?: number;
        numberOfFanSpeeds?: number;
        
        // Error handling
        hasError: boolean;
        errorCode: number;
        errorMessages: string;
        
        // Device capabilities
        canCool?: boolean;
        canHeat?: boolean;
        canDry?: boolean;
        
        // Temperature limits
        minTempCoolDry?: number;
        maxTempCoolDry?: number;
        minTempHeat?: number;
        maxTempHeat?: number;
        minTempAuto?: number;
        maxTempAuto?: number;
        
        // Heat pump specific (ATW devices)
        hasZone2?: boolean;
        roomTemperatureZone1?: number;
        roomTemperatureZone2?: number;
        tankWaterTemperature?: number;
        mixingTankWaterTemperature?: number;
        flowTemperature?: number;
        flowTemperatureZone1?: number;
        flowTemperatureZone2?: number;
        flowTemperatureBoiler?: number;
        returnTemperature?: number;
        returnTemperatureZone1?: number;
        returnTemperatureZone2?: number;
        returnTemperatureBoiler?: number;
        condensingTemperature?: number;
        heatPumpFrequency?: number;
        operationState?: number;
        
        // Heat pump control settings
        setTankWaterTemperature?: number;
        setTemperatureZone1?: number;
        setTemperatureZone2?: number;
        setHeatFlowTemperatureZone1?: number;
        setHeatFlowTemperatureZone2?: number;
        setCoolFlowTemperatureZone1?: number;
        setCoolFlowTemperatureZone2?: number;
        forcedHotWaterMode?: boolean;
        operationModeZone1?: number;
        operationModeZone2?: number;
    }

    export interface SetDeviceParams {
        power?: boolean;
        temperature?: number;
        fanSpeed?: number | 'auto';
        mode?: 'heat' | 'hot' | 'h' | 'dry' | 'd' | 'cold' | 'cool' | 'c' | 'fan' | 'air' | 'f' | 'auto' | 'a' | number;
        vaneHorizontal?: number | 'auto' | 'swing';
        vaneVertical?: number | 'auto' | 'swing';
    }

    export interface SetHeatPumpParams {
        power?: boolean;
        forcedHotWaterMode?: boolean;
        operationModeZone1?: number;
        operationModeZone2?: number;
        setTankWaterTemperature?: number;
        setTemperatureZone1?: number;
        setTemperatureZone2?: number;
        setHeatFlowTemperatureZone1?: number;
        setHeatFlowTemperatureZone2?: number;
        setCoolFlowTemperatureZone1?: number;
        setCoolFlowTemperatureZone2?: number;
    }

    export interface EnergyReportData {
        deviceId: number;
        fromDate: string;
        toDate: string;
        totalMinutes: number;
        totalPowerConsumption: number;
        totalPowerProduction: number;
        
        // Air conditioning specific
        totalPowerConsumptionAuto: number;
        totalPowerConsumptionHeat: number;
        totalPowerConsumptionCool: number;
        totalPowerConsumptionDry: number;
        totalPowerConsumptionVent: number;
        
        // Heat pump specific
        totalPowerConsumptionHeating: number;
        totalPowerConsumptionCooling: number;
        totalPowerConsumptionHotWater: number;
        totalPowerProductionHeating: number;
        totalPowerProductionCooling: number;
        totalPowerProductionHotWater: number;
        
        rawData: any;
    }

    export interface DeviceStatusSummary {
        id: number;
        name: string;
        type: string;
        online: boolean;
        hasError: boolean;
        errorCode: number;
        errorMessages: string;
        power: boolean;
        lastCommunication: string;
        wifiSignalStrength?: number;
        
        // Temperature info
        roomTemperature?: number;
        outdoorTemperature?: number;
        targetTemperature?: number;
        
        // Device capabilities
        canCool?: boolean;
        canHeat?: boolean;
        canDry?: boolean;
        
        // Heat pump specific
        hasZone2?: boolean;
        tankWaterTemperature?: number;
        operationState?: number;
    }

    export default class MELCloudAPI {
        constructor(email: string, password: string, options?: MELCloudOptions);
        
        // Authentication
        login(): Promise<string>;
        
        // Device discovery and info
        getDevices(): Promise<DeviceInfo[]>;
        getDevice(deviceId: number, buildingId?: number | null): Promise<DeviceInfo>;
        getDeviceStatus(deviceId: number, buildingId?: number | null): Promise<DeviceStatusSummary>;
        getDevicesByType(deviceType: number | 'air-conditioner' | 'heat-pump'): Promise<DeviceInfo[]>;
        getAirConditioners(): Promise<DeviceInfo[]>;
        getHeatPumps(): Promise<DeviceInfo[]>;
        
        // Air conditioner control
        setDevice(deviceId: number, params: SetDeviceParams, buildingId?: number | null): Promise<DeviceInfo>;
        turnOn(deviceId: number, buildingId?: number | null): Promise<DeviceInfo>;
        turnOff(deviceId: number, buildingId?: number | null): Promise<DeviceInfo>;
        setTemperature(deviceId: number, temperature: number, buildingId?: number | null): Promise<DeviceInfo>;
        
        // Heat pump control
        setHeatPumpDevice(deviceId: number, params: SetHeatPumpParams, buildingId?: number | null): Promise<DeviceInfo>;
        setHotWaterMode(deviceId: number, enabled: boolean, buildingId?: number | null): Promise<DeviceInfo>;
        setTankWaterTemperature(deviceId: number, temperature: number, buildingId?: number | null): Promise<DeviceInfo>;
        setZoneTemperature(deviceId: number, zone: 1 | 2, temperature: number, buildingId?: number | null): Promise<DeviceInfo>;
        
        // Energy monitoring
        getEnergyReport(deviceId: number, fromDate: string, toDate: string, buildingId?: number | null): Promise<EnergyReportData>;
    }
}
