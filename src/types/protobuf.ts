
// Based on the provided file.proto

export enum Statuses {
  Ok = 0,
  Error = 1,
}

export enum LighStates { // Note: Standard Naming convention would be LightStates
  On = 0,
  Off = 1,
}

export enum DoorLockStates {
  Open = 0,
  Close = 1,
}

export enum ChannelStates {
  ChannelOn = 0,
  ChannelOff = 1,
}

// This enum defines the 'state' for the SetState message
export enum States {
  LightOn = 0,
  LightOff = 1,
  DoorLockOpen = 2,
  DoorLockClose = 3,
  Channel1On = 4,
  Channel1Off = 5,
  Channel2On = 6,
  Channel2Off = 7,
}

// Message Definitions for Request Payloads (used inside ClientMessage oneof)
export interface GetInfoRequest {} // Empty message
export interface GetStateRequest {} // Empty message
export interface SetStateRequest {
  state: States; // Uses the States enum
}

// This is the actual structure of the ClientMessage Protobuf
// The frontend will construct a JSON object where the 'message' field contains one of these.
export type ClientMessageOneofPayload =
  | { get_info: GetInfoRequest }
  | { set_state: SetStateRequest }
  | { get_state: GetStateRequest };

export interface ProtoClientMessage { // Represents the Protobuf ClientMessage
  message: ClientMessageOneofPayload;
}


// Message Definitions for Response Payloads (used inside ControllerResponse oneof)
export interface InfoResponse {
  ip: string;
  mac: string;
  ble_name: string;
  token: string; // Controller's internal token
}

export interface StateResponse {
  light_on: LighStates;
  door_lock: DoorLockStates;
  channel_1: ChannelStates;
  channel_2: ChannelStates;
  temperature: number;
  pressure: number;
  humidity: number;
}

export type ControllerResponseOneofPayload =
  | { info: InfoResponse }
  | { state: StateResponse }
  | { status: Statuses };

export interface ProtoControllerResponse { // Represents the Protobuf ControllerResponse
  response: ControllerResponseOneofPayload;
}

// Helper type for what the frontend receives from the bridge (after JSON parsing)
export type BridgeResponse = 
  | { data: ProtoControllerResponse } 
  | { error: string };

// Type for the JSON payload frontend sends to the bridge
export interface FrontendWebsocketMessage {
    auth_token: string | null;
    room_id: string | null;
    message: ClientMessageOneofPayload;
}
