
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const WebSocket = require('ws');
const net       = require('net');
const path      = require('path');
const protobuf  = require('protobufjs');

const CONTROLLER_IP         = process.env.CONTROLLER_IP         || '192.168.1.100';
const CONTROLLER_PORT       = parseInt(process.env.CONTROLLER_PORT       || '7000', 10);
const BRIDGE_WEBSOCKET_PORT = parseInt(process.env.BRIDGE_WEBSOCKET_PORT || '8080', 10);
const TCP_TIMEOUT_MS        = parseInt(process.env.TCP_TIMEOUT_MS || '5000', 10);

// Загружаем .proto
// __dirname is src/server, so ../../file.proto refers to project_root/file.proto
const protoPath = path.resolve(__dirname, '../../file.proto'); 
let ClientMessage, ControllerResponse;

try {
    const root = protobuf.loadSync(protoPath);
    ClientMessage      = root.lookupType('ClientMessage');
    ControllerResponse = root.lookupType('ControllerResponse');
    console.log('Protobuf definitions loaded successfully.');
} catch (err) {
    console.error('Failed to load Protobuf definitions:', err);
    process.exit(1); // Exit if .proto file cannot be loaded
}


console.log(`WebSocket Bridge server started on ws://localhost:${BRIDGE_WEBSOCKET_PORT}`);
console.log(`Attempting to connect to controller at ${CONTROLLER_IP}:${CONTROLLER_PORT}`);

const wss = new WebSocket.Server({ port: BRIDGE_WEBSOCKET_PORT });

function oneShotProtobuf(payloadFromFrontend, callback) {
  // payloadFromFrontend is the entire JSON object from the WebSocket message.
  // We need payloadFromFrontend.message for the protobuf ClientMessage part.
  const clientMessageProtoPayload = payloadFromFrontend.message;

  if (!clientMessageProtoPayload || typeof clientMessageProtoPayload !== 'object') {
    return callback(new Error('Invalid or missing "message" field in payload for Protobuf.'));
  }

  const oneofFieldName = Object.keys(clientMessageProtoPayload)[0];
  const oneofFieldValue = Object.values(clientMessageProtoPayload)[0];

  if (!oneofFieldName || (typeof oneofFieldValue !== 'object' && oneofFieldValue !== undefined /* for empty messages like GetInfo */)) {
      return callback(new Error(`Invalid "message" content: ${JSON.stringify(clientMessageProtoPayload)}`));
  }
  
  // Create Protobuf message
  let errMsg;
  try {
    errMsg = ClientMessage.verify({ [oneofFieldName]: oneofFieldValue });
  } catch (e) {
    return callback(new Error(`Protobuf verification error for ${oneofFieldName}: ${e.message}`));
  }
  if (errMsg) {
      return callback(new Error(`Protobuf verification failed for ${oneofFieldName}: ${errMsg}`));
  }

  const clientMessageInstance = ClientMessage.create({ [oneofFieldName]: oneofFieldValue });
  const msgBytes = ClientMessage.encode(clientMessageInstance).finish();
  
  // Prefix with length
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(msgBytes.length, 0);
  const packet = Buffer.concat([lenBuf, msgBytes]);

  console.log(`[Bridge] Sending to TCP ${CONTROLLER_IP}:${CONTROLLER_PORT}: Length=${msgBytes.length}, OneofField=${oneofFieldName}, Value=${JSON.stringify(oneofFieldValue)}`);

  const tcp = new net.Socket();
  let responded = false, buffer = Buffer.alloc(0), expectedLen = null;

  tcp.setTimeout(TCP_TIMEOUT_MS, () => {
    if (!responded) {
      console.error('[Bridge] TCP timeout occurred.');
      callback(new Error('TCP timeout with controller'));
      tcp.destroy();
      responded = true; // Ensure callback is only called once
    }
  });

  tcp.connect(CONTROLLER_PORT, CONTROLLER_IP, () => {
    console.log('[Bridge] TCP connected. Writing packet.');
    tcp.write(packet);
  });

  tcp.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    console.log(`[Bridge] TCP data received, buffer length: ${buffer.length}`);
    if (expectedLen === null && buffer.length >= 4) {
      expectedLen = buffer.readUInt32BE(0);
      console.log(`[Bridge] Expected TCP response length: ${expectedLen}`);
    }
    if (expectedLen !== null && buffer.length >= 4 + expectedLen) {
      const msgBuf = buffer.slice(4, 4 + expectedLen);
      try {
        const resp   = ControllerResponse.decode(msgBuf);
        console.log('[Bridge] TCP response decoded:', JSON.stringify(resp.toJSON()));
        if (!responded) {
            responded = true;
            callback(null, resp.toJSON()); // Convert to plain JS object for JSON stringification
        }
      } catch (e) {
          console.error('[Bridge] Error decoding TCP response:', e);
          if (!responded) {
            responded = true;
            callback(new Error(`Protobuf decode error: ${e.message}`));
          }
      }
      tcp.destroy();
    } else if (expectedLen !== null && buffer.length < 4 + expectedLen) {
        console.log(`[Bridge] TCP data chunk received, waiting for more. Buffer: ${buffer.length}, Expected: ${4+expectedLen}`);
    }
  });

  tcp.on('error', (err) => {
    console.error('[Bridge] TCP connection error:', err.message);
    if (!responded) {
      responded = true;
      callback(err);
    }
    tcp.destroy();
  });

  tcp.on('close', () => {
      console.log('[Bridge] TCP connection closed.');
      if(!responded){ // If connection closed before any response or error
          // callback(new Error('TCP connection closed unexpectedly by controller.'));
          // Responded might already be true if timeout or other error occurred.
      }
  });
}

wss.on('connection', (ws) => {
  console.log('[Bridge] Frontend client connected via WebSocket.');
  ws.on('message', (msg) => {
    let payloadFromFrontend;
    const messageString = msg.toString();
    console.log(`[Bridge] Received from frontend (raw): ${messageString}`);

    try { 
      payloadFromFrontend = JSON.parse(messageString); 
    }
    catch (e) { 
      console.error('[Bridge] Invalid JSON from frontend:', e.message);
      return ws.send(JSON.stringify({ error: 'Invalid JSON' })); 
    }

    // Basic validation of the payload structure expected by the bridge
    if (!payloadFromFrontend.message || typeof payloadFromFrontend.message !== 'object') {
      console.error('[Bridge] Missing or invalid "message" field in frontend payload.');
      return ws.send(JSON.stringify({ error: 'Invalid payload: Missing or malformed "message" field' }));
    }
    
    // Here you could add JWT validation for payloadFromFrontend.auth_token
    // For now, we just log it if present
    if (payloadFromFrontend.auth_token) {
        console.log(`[Bridge] Received auth_token: ${payloadFromFrontend.auth_token}, room_id: ${payloadFromFrontend.room_id || 'N/A'}`);
    }


    oneShotProtobuf(payloadFromFrontend, (err, resp) => {
      if (err) {
        console.error('[Bridge] Error in oneShotProtobuf:', err.message);
        ws.send(JSON.stringify({ error: err.message }));
      } else {
        console.log('[Bridge] Sending response to frontend:', JSON.stringify({ data: resp }));
        ws.send(JSON.stringify({ data: resp }));
      }
    });
  });

  ws.on('close', () => {
    console.log('[Bridge] Frontend client disconnected.');
  });

  ws.on('error', (err) => {
      console.error('[Bridge] WebSocket error for a client:', err.message);
  });
});

console.log('[Bridge] Setup complete. Waiting for WebSocket connections.');
