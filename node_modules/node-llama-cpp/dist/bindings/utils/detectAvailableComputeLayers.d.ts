import { BinaryPlatform } from "./getPlatform.js";
export declare function detectAvailableComputeLayers({ platform }?: {
    platform?: BinaryPlatform;
}): Promise<{
    cuda: {
        hasNvidiaDriver: boolean;
        hasCudaRuntime: boolean;
    };
    vulkan: boolean;
    metal: boolean;
}>;
export declare function getCudaNvccPaths({ platform }?: {
    platform?: BinaryPlatform;
}): Promise<string[]>;
export declare function getWindowsProgramFilesPaths(): Promise<string[]>;
