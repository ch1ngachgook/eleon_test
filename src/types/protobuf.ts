// Based on the provided .proto file

export enum ProtoStatuses {
  Ok = 0,
  Error = 1,
}

export enum ProtoLightStates {
  On = 0,
  Off = 1,
}

export enum ProtoDoorLockStates {
  Open = 0,
  Close = 1,
}

export enum ProtoChannelStates {
  ChannelOn = 0,
  ChannelOff = 1,
}

// Command states for set_state
export enum ProtoCommandStates {
  LightOn = 0,
  LightOff = 1,
  DoorLockOpen = 2,
  DoorLockClose = 3,
  Channel1On = 4,
  Channel1Off = 5,
  Channel2On = 6,
  Channel2Off = 7,
}

export interface ProtoIdentifyRequest {
  Token: string;
}

export interface ProtoGetStateRequest {}

export interface ProtoGetInfoRequest {}

export interface ProtoSetStateRequest {
  state: ProtoCommandStates;
}

export interface ProtoStateResponse {
  light_on: ProtoLightStates;
  door_lock: ProtoDoorLockStates;
  channel_1: ProtoChannelStates;
  channel_2: ProtoChannelStates;
  temperature: number;
  pressure: number;
  humidity: number;
}

export interface ProtoInfoResponse {
  ip: string;
  mac: string;
  ble_name: string;
  token: string;
}

// ClientMessage (Request)
export type ProtoClientMessagePayload =
  | { get_info: ProtoGetInfoRequest }
  | { set_state: ProtoSetStateRequest }
  | { get_state: ProtoGetStateRequest };

export interface ProtoClientMessage {
  message: ProtoClientMessagePayload;
}

// ControllerResponse
export type ProtoControllerResponsePayload =
  | { info: ProtoInfoResponse }
  | { state: ProtoStateResponse }
  | { status: ProtoStatuses };

export interface ProtoControllerResponse {
  response: ProtoControllerResponsePayload;
}
