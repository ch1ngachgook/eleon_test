// Simulated Web Bluetooth API service

interface MockBluetoothDevice {
  id: string;
  name?: string;
  gatt?: MockBluetoothRemoteGATTServer;
}

interface MockBluetoothRemoteGATTServer {
  connect: () => Promise<MockBluetoothRemoteGATTServer>;
  disconnect: () => void;
  getPrimaryService: (serviceUUID: string) => Promise<MockBluetoothRemoteGATTService>;
}

interface MockBluetoothRemoteGATTService {
  getCharacteristic: (characteristicUUID: string) => Promise<MockBluetoothRemoteGATTCharacteristic>;
}

interface MockBluetoothRemoteGATTCharacteristic {
  writeValue: (value: BufferSource) => Promise<void>;
  readValue: () => Promise<DataView>;
  startNotifications: () => Promise<MockBluetoothRemoteGATTCharacteristic>;
  stopNotifications: () => Promise<MockBluetoothRemoteGATTCharacteristic>;
  addEventListener: (type: 'characteristicvaluechanged', listener: (event: any) => void) => void;
  removeEventListener: (type: 'characteristicvaluechanged', listener: (event: any) => void) => void;
}

let mockDevice: MockBluetoothDevice | null = null;
let mockServer: MockBluetoothRemoteGATTServer | null = null;

export async function requestDevice(options?: RequestDeviceOptions): Promise<MockBluetoothDevice | null> {
  console.log('[BLE Service] Requesting device with options:', options);
  return new Promise((resolve, reject) => {
    // Simulate user selection
    const deviceName = options?.filters?.[0]?.name || `HotelKeyRoom-Device`;
    if (confirm(`Connect to simulated BLE device "${deviceName}"?`)) {
      mockDevice = {
        id: `mock-device-${Date.now()}`,
        name: deviceName,
      };
      console.log('[BLE Service] Device selected:', mockDevice);
      resolve(mockDevice);
    } else {
      console.log('[BLE Service] Device selection cancelled.');
      reject(new Error('User cancelled device selection.'));
      resolve(null);
    }
  });
}

export async function connectToGattServer(device: MockBluetoothDevice): Promise<MockBluetoothRemoteGATTServer> {
  console.log('[BLE Service] Connecting to GATT server for device:', device.name);
  if (!device) throw new Error('Device not available');
  
  mockServer = {
    connect: async () => {
      console.log('[BLE Service] GATT Server Connected.');
      return mockServer!;
    },
    disconnect: () => {
      console.log('[BLE Service] GATT Server Disconnected.');
      mockServer = null;
    },
    getPrimaryService: async (serviceUUID: string) => {
      console.log(`[BLE Service] Getting primary service: ${serviceUUID}`);
      // Simulate finding a service
      return {
        getCharacteristic: async (characteristicUUID: string) => {
          console.log(`[BLE Service] Getting characteristic: ${characteristicUUID}`);
          // Simulate finding a characteristic
          return {
            writeValue: async (value: BufferSource) => {
              console.log(`[BLE Service] Writing value to characteristic ${characteristicUUID}:`, value);
            },
            readValue: async () => {
              console.log(`[BLE Service] Reading value from characteristic ${characteristicUUID}`);
              const mockData = new Uint8Array([1, 2, 3]); // Example data
              return new DataView(mockData.buffer);
            },
            startNotifications: async () => {
              console.log(`[BLE Service] Starting notifications for ${characteristicUUID}`);
              return this as unknown as MockBluetoothRemoteGATTCharacteristic; //This will be fixed by casting
            },
            stopNotifications: async () => {
              console.log(`[BLE Service] Stopping notifications for ${characteristicUUID}`);
               return this as unknown as MockBluetoothRemoteGATTCharacteristic; //This will be fixed by casting
            },
            addEventListener: (type: string, listener: (event: any) => void) => {
               console.log(`[BLE Service] Adding event listener ${type} for ${characteristicUUID}`);
            },
            removeEventListener: (type: string, listener: (event: any) => void) => {
               console.log(`[BLE Service] Removing event listener ${type} for ${characteristicUUID}`);
            }
          } as MockBluetoothRemoteGATTCharacteristic;
        },
      } as MockBluetoothRemoteGATTService;
    },
  };
  
  await mockServer.connect();
  return mockServer;
}

// Example command functions
export async function sendDoorCommand(open: boolean): Promise<void> {
  console.log(`[BLE Service] Sending door command: ${open ? 'OPEN' : 'CLOSE'}`);
  // In a real scenario, you'd get the characteristic and write the value.
  // e.g., const characteristic = await service.getCharacteristic(DOOR_CHARACTERISTIC_UUID);
  // await characteristic.writeValue(new Uint8Array([open ? 1 : 0]));
  if (!mockServer) {
    console.warn('[BLE Service] Not connected to BLE device. Door command simulated.');
    return;
  }
  // Simulate write
}

export async function sendLightCommand(on: boolean): Promise<void> {
  console.log(`[BLE Service] Sending light command: ${on ? 'ON' : 'OFF'}`);
  if (!mockServer) {
    console.warn('[BLE Service] Not connected to BLE device. Light command simulated.');
    return;
  }
  // Simulate write
}

export async function sendAcCommand(on: boolean): Promise<void> {
  console.log(`[BLE Service] Sending A/C command: ${on ? 'ON' : 'OFF'}`);
   if (!mockServer) {
    console.warn('[BLE Service] Not connected to BLE device. A/C command simulated.');
    return;
  }
  // Simulate write
}
