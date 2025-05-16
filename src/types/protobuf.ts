
// Based on the provided file.proto

export enum Statuses {
  Ok = 0,
  Error = 1,
}

export enum LighStates { // Matches file.proto
  On = 0,
  Off = 1,
}

export enum DoorLockStates { // Matches file.proto
  Open = 0,
  Close = 1,
}

export enum ChannelStates { // Matches file.proto
  ChannelOn = 0,
  ChannelOff = 1,
}

// This enum defines the 'state' for the SetState message
export enum States { // Matches file.proto
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

// This is the type for the `message` field within FrontendWebsocketMessage
// It represents the `oneof message` part of ClientMessage in file.proto
export type ClientMessageOneofPayload =
  | { get_info: GetInfoRequest }
  | { set_state: SetStateRequest }
  | { get_state: GetStateRequest };

// Message Definitions for Response Payloads (used inside ControllerResponse oneof)
// These are the JSON shapes after bridge's resp.toJSON()
export interface InfoResponse {
  ip: string;
  mac: string;
  ble_name: string;
  token: string; // Controller's internal token
}

export interface StateResponse {
  light_on: LighStates; // Expecting 0 or 1
  door_lock: DoorLockStates; // Expecting 0 or 1
  channel_1: ChannelStates; // Expecting 0 or 1
  channel_2: ChannelStates; // Expecting 0 or 1
  temperature: number;
  pressure: number;
  humidity: number;
}

export type ControllerResponseOneofPayload =
  | { info: InfoResponse }
  | { state: StateResponse }
  | { status: Statuses }; // Expecting 0 or 1

export interface ProtoControllerResponse { // Represents the JSON structure of ControllerResponse from bridge
  response: ControllerResponseOneofPayload;
}

// Helper type for what the frontend receives from the bridge (after JSON parsing)
// The bridge wraps the controller's JSON response in a "data" field.
export type BridgeResponse = 
  | { data: ProtoControllerResponse } 
  | { error: string };

// Type for the JSON payload frontend sends to the bridge
// This is the entire object sent over WebSocket
export interface FrontendWebsocketMessage {
    auth_token: string | null;
    room_id: string | null;
    message: ClientMessageOneofPayload; // This is the part that maps to ClientMessage's oneof
}
