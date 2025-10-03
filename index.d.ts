// 100% AI generated file. May contain errors.
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
    }

    export interface SetDeviceParams {
        power?: boolean;
        temperature?: number;
        fanSpeed?: number | 'auto';
        mode?: 'heat' | 'dry' | 'cold' | 'cool' | 'fan' | 'auto';
        vaneHorizontal?: number | 'auto' | 'swing';
        vaneVertical?: number | 'auto' | 'swing';
    }

    export default class MELCloudAPI {
        constructor(email: string, password: string, options?: MELCloudOptions);
        
        login(): Promise<string>;
        getDevices(): Promise<DeviceInfo[]>;
        getDevice(deviceId: number, buildingId?: number | null): Promise<DeviceInfo>;
        setDevice(deviceId: number, params: SetDeviceParams, buildingId?: number | null): Promise<DeviceInfo>;
        turnOn(deviceId: number, buildingId?: number | null): Promise<DeviceInfo>;
        turnOff(deviceId: number, buildingId?: number | null): Promise<DeviceInfo>;
        setTemperature(deviceId: number, temperature: number, buildingId?: number | null): Promise<DeviceInfo>;
    }
}
