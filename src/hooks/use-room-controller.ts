
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useHotelStore } from '@/store/useStore'; // To get authToken
import { toast } from '@/hooks/use-toast';
import {
  type InfoResponse,
  type StateResponse,
  Statuses,
  States,
  LighStates,
  DoorLockStates,
  ChannelStates,
  type ClientMessageOneofPayload,
  type BridgeResponse,
  type FrontendWebsocketMessage,
  type ProtoControllerResponse
} from '@/types/protobuf';

const BRIDGE_WEBSOCKET_URL_BASE = typeof window !== 'undefined' ?
  `${process.env.NEXT_PUBLIC_BRIDGE_HOST || window.location.hostname}:${process.env.NEXT_PUBLIC_BRIDGE_PORT || '8080'}` :
  'localhost:8080'; // Fallback for SSR
const BRIDGE_WEBSOCKET_URL = typeof window !== 'undefined' ? `ws://${BRIDGE_WEBSOCKET_URL_BASE}` : 'ws://localhost:8080';


const GET_STATE_INTERVAL = 7000; // Interval for polling state in ms
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 2000; // ms, initial delay
const RECONNECT_DELAY_MAX = 30000; // ms, max delay

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ControllerError = { message: string; type: 'websocket' | 'command_error' | 'auth' | 'parse' | 'bridge' } | null;

const initialHardwareState: StateResponse = {
  light_on: LighStates.Off,
  door_lock: DoorLockStates.Close,
  channel_1: ChannelStates.ChannelOff,
  channel_2: ChannelStates.ChannelOff,
  temperature: 0,
  humidity: 0,
  pressure: 0,
};

export function useRoomController(roomId: string, authToken: string | null) {
  const [deviceInfo, setDeviceInfo] = useState<InfoResponse | null>(null);
  const [hardwareState, setHardwareState] = useState<StateResponse>(initialHardwareState);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<ControllerError>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendMessageToBridge = useCallback((payload: ClientMessageOneofPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // For get_info, auth_token and room_id are not strictly needed by the ClientMessage protobuf,
      // but the bridge might use them for logging or other purposes.
      // The bridge will only use the 'message' part for protobuf encoding.
      const messageForBridge: FrontendWebsocketMessage = {
        auth_token: 'get_info' in payload ? null : authToken,
        room_id: 'get_info' in payload ? null : roomId,
        message: payload
      };
      try {
        const jsonMessage = JSON.stringify(messageForBridge);
        console.log(`[useRoomController] Sending to bridge: ${jsonMessage}`);
        wsRef.current.send(jsonMessage);
        if ('set_state' in payload) {
            setIsSendingCommand(true);
        }
      } catch (e) {
        console.error('[useRoomController] Failed to stringify or send message:', e);
        setError({ message: 'Failed to construct or send command to bridge.', type: 'websocket' });
        setIsSendingCommand(false);
      }
    } else {
      setError({ message: 'WebSocket connection not open.', type: 'websocket' });
      toast({ title: 'Connection Error', description: 'Not connected to the controller bridge.', variant: 'destructive' });
      setIsSendingCommand(false);
    }
  }, [authToken, roomId]);

  const handleBridgeResponse = useCallback((data: any) => {
    const bridgeResponse = data as BridgeResponse; // data is the parsed JSON from WebSocket
    console.log('[useRoomController] Received from bridge:', bridgeResponse);

    if (bridgeResponse.error) {
      console.error('[useRoomController] Error from bridge:', bridgeResponse.error);
      setError({ message: bridgeResponse.error, type: 'bridge' });
      toast({ title: 'Bridge Error', description: bridgeResponse.error, variant: 'destructive' });
      setIsSendingCommand(false);
      return;
    }

    if (bridgeResponse.data) {
      // bridgeResponse.data is the ProtoControllerResponse (JSON version)
      const controllerProtoResponse = bridgeResponse.data;
      if ('info' in controllerProtoResponse.response) {
        const receivedInfo = controllerProtoResponse.response.info;
        setDeviceInfo(receivedInfo);
        // Update with the hardcoded values for display consistency in this demo
        // setDeviceInfo({
        //   ip: "192.168.1.100",
        //   mac: "FE:E8:C0:D4:57:14",
        //   ble_name: "ROOM_7",
        //   token: "CM6wqJB5blIMvBKQ"
        // });
        toast({ title: 'Controller Info', description: `Fetched info for ${receivedInfo.ble_name || 'controller'}.` });
        
        // After getting info, if authenticated, get initial state and start polling
        if (authToken && roomId) {
          sendMessageToBridge({ get_state: {} });
          if (stateUpdateIntervalRef.current) clearInterval(stateUpdateIntervalRef.current);
          stateUpdateIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              sendMessageToBridge({ get_state: {} });
            }
          }, GET_STATE_INTERVAL);
        } else {
          toast({ title: "Info Received", description: "Controller info loaded. Authenticate to control the room.", variant: "default" });
        }
      } else if ('state' in controllerProtoResponse.response) {
        setHardwareState(controllerProtoResponse.response.state);
      } else if ('status' in controllerProtoResponse.response) {
        if (controllerProtoResponse.response.status === Statuses.Ok) {
          toast({ title: 'Command Success', description: 'Controller confirmed action.' });
          if (authToken && roomId) { // Refresh state after successful command
             sendMessageToBridge({ get_state: {} });
          }
        } else {
          const errorMsg = `Controller command failed for Room ${roomId}. Status: ${Statuses[controllerProtoResponse.response.status] || 'Unknown Error Status'}`;
          toast({ title: 'Command Error', description: errorMsg, variant: 'destructive' });
          setError({ message: errorMsg, type: 'command_error' });
        }
      }
    }
    setIsSendingCommand(false);
  }, [sendMessageToBridge, authToken, roomId]);


  const disconnect = useCallback((isAttemptingReconnect = false) => {
    if (stateUpdateIntervalRef.current) {
      clearInterval(stateUpdateIntervalRef.current);
      stateUpdateIntervalRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent onclose handler from trying to reconnect if we are manually disconnecting
      wsRef.current.close();
      wsRef.current = null;
    }
    if (!isAttemptingReconnect) { // Only reset states if not part of a reconnect cycle
        setConnectionStatus('disconnected');
        // setDeviceInfo(null); // Keep info on brief disconnects unless full reset
        // setHardwareState(initialHardwareState); // Keep state on brief disconnects
        console.log(`[useRoomController] WebSocket Disconnected for room ${roomId}`);
    }
  }, [roomId]);


  const connect = useCallback(() => {
     if (!authToken && roomId) { // Allow get_info without auth, but show warning
        toast({title: "Authentication Recommended", description: "No auth token found. You can fetch controller info, but commands will require authentication.", variant:"default"});
     } else if (!authToken && !roomId) { // If trying to connect from a context where roomId might also be missing (e.g. generic controller page)
        toast({title: "Missing Room ID & Auth", description: "Room ID and Auth Token are required for full functionality.", variant:"destructive"});
        // For the HotelKey app, roomId should always be present on the room page.
        // But this hook might be used in /controller-ui where roomId is also from store.
     }


     if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        console.log("[useRoomController] WebSocket already connecting or open.");
        if(connectionStatus === 'connected') {
            sendMessageToBridge({ get_info: {} });
            if (authToken && roomId && !stateUpdateIntervalRef.current) { 
                stateUpdateIntervalRef.current = setInterval(() => sendMessageToBridge({ get_state: {} }), GET_STATE_INTERVAL);
            }
        }
        return;
    }

    disconnect(true); // Disconnect with intent to reconnect/connect
    setConnectionStatus('connecting');
    setError(null);
    // Do not reset reconnectAttemptsRef.current here, onopen will do it.
    
    console.log(`[useRoomController] Attempting to connect to WebSocket: ${BRIDGE_WEBSOCKET_URL} for room ${roomId}`);

    try {
        wsRef.current = new WebSocket(BRIDGE_WEBSOCKET_URL);
    } catch (e) {
        const err = e as Error;
        console.error(`[useRoomController] WebSocket instantiation error for room ${roomId}:`, err);
        setError({ message: err.message || 'Failed to create WebSocket.', type: 'websocket' });
        setConnectionStatus('error');
        return;
    }

    connectTimeoutRef.current = setTimeout(() => {
        if (connectionStatus === 'connecting') {
            console.error(`[useRoomController] WebSocket connection timeout for room ${roomId}.`);
            setError({ message: 'Connection attempt timed out.', type: 'websocket' });
            setConnectionStatus('error');
            if (wsRef.current) {
                 wsRef.current.onopen = null;
                 wsRef.current.onmessage = null;
                 wsRef.current.onerror = null;
                 wsRef.current.onclose = null;
                 wsRef.current.close();
                 wsRef.current = null;
            }
            // Attempt reconnect after timeout if policy allows
            // handleWebSocketClose({ wasClean: false, code: 4008, reason: "Connection Timeout" } as CloseEvent);
        }
    }, 10000); // 10 second connection timeout


    wsRef.current.onopen = () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      console.log(`[useRoomController] WebSocket Connected to bridge for room ${roomId}`);
      reconnectAttemptsRef.current = 0; // Reset on successful connection
      setConnectionStatus('connected');
      toast({ title: 'Bridge Connected', description: `Connection to bridge established for Room ${roomId}.`});
      sendMessageToBridge({ get_info: {} }); // Always get_info on connect.
      // Polling for get_state will start after info is received if authenticated
    };

    wsRef.current.onmessage = (event: MessageEvent) => {
      try {
        const parsedData = JSON.parse(event.data as string);
        handleBridgeResponse(parsedData);
      } catch (e) {
        console.error('[useRoomController] Error parsing JSON message from bridge:', event.data, e);
        setError({ message: 'Invalid JSON response from bridge.', type: 'parse' });
        setIsSendingCommand(false);
      }
    };
    
    const handleWebSocketClose = (event: CloseEvent) => {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        console.log(`[useRoomController] WebSocket Connection Closed for room ${roomId}. Code: ${event.code}, Clean: ${event.wasClean}, Reason: ${event.reason}`);
        if (stateUpdateIntervalRef.current) {
            clearInterval(stateUpdateIntervalRef.current);
            stateUpdateIntervalRef.current = null;
        }

        // Only try to reconnect if it wasn't a clean disconnect (e.g., server closed, network error)
        // and we are not already in a 'disconnected' state set by manual disconnect()
        if (!event.wasClean && connectionStatus !== 'disconnected') {
            reconnectAttemptsRef.current++;
            if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current -1), RECONNECT_DELAY_MAX);
                console.log(`[useRoomController] Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay/1000}s...`);
                setConnectionStatus('connecting'); // Show user we are trying
                setError({message: `Connection lost. Attempting to reconnect... (${reconnectAttemptsRef.current})`, type: 'websocket'});
                setTimeout(() => {
                    if (connectionStatus === 'connecting') connect(); // Only connect if still in 'connecting' state
                }, delay);
            } else {
                console.error(`[useRoomController] Max reconnect attempts reached for room ${roomId}.`);
                setError({ message: 'Failed to connect to the bridge after multiple attempts.', type: 'websocket' });
                setConnectionStatus('error');
            }
        } else {
            // If it was a clean close, or we manually disconnected, just ensure state is 'disconnected' or 'error'
            if (connectionStatus !== 'error' && connectionStatus !== 'disconnected') {
                setConnectionStatus('disconnected');
            }
        }
         // wsRef.current = null; // Should be nulled by disconnect or if it's truly closed
    };

    wsRef.current.onerror = (event) => {
      // onerror is usually followed by onclose. Let onclose handle reconnect logic.
      console.error(`[useRoomController] WebSocket Error for room ${roomId}:`, event);
      setError({ message: 'WebSocket connection error. Bridge service might be offline or unreachable.', type: 'websocket' });
      // setConnectionStatus('error'); // onclose will set appropriate state
    };

    wsRef.current.onclose = handleWebSocketClose;
  }, [roomId, authToken, disconnect, handleBridgeResponse, sendMessageToBridge, connectionStatus]);


  useEffect(() => {
    // Cleanup on unmount
    return () => {
      console.log(`[useRoomController] Unmounting for room ${roomId}, disconnecting.`);
      disconnect();
    };
  }, [disconnect, roomId]);

  const sendCommandToController = useCallback((command: States) => {
    if (!authToken) {
      toast({ title: 'Command Failed', description: 'Authentication token is missing.', variant: 'destructive' });
      setError({message: 'Auth token missing for command.', type: 'auth'});
      return;
    }
    if (connectionStatus !== 'connected') {
      toast({ title: 'Command Failed', description: 'Not connected to controller bridge.', variant: 'destructive' });
      setError({message: 'Not connected to controller bridge.', type: 'websocket'});
      return;
    }
    setError(null); // Clear previous errors before sending new command
    sendMessageToBridge({ set_state: { state: command } });
  }, [connectionStatus, sendMessageToBridge, authToken]);

  return {
    deviceInfo,
    hardwareState,
    connectionStatus,
    error,
    isSendingCommand,
    connect,
    disconnect,
    sendCommand: sendCommandToController,
  };
}
