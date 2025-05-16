
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const WebSocket = require('ws');
const net = require('net');

const CONTROLLER_IP = process.env.CONTROLLER_IP || '192.168.1.100';
const CONTROLLER_PORT = parseInt(process.env.CONTROLLER_PORT || '7000', 10);
const BRIDGE_WEBSOCKET_PORT = parseInt(process.env.BRIDGE_WEBSOCKET_PORT || '8080', 10);

const wss = new WebSocket.Server({ port: BRIDGE_WEBSOCKET_PORT });

console.log(`WebSocket Bridge server started on ws://localhost:${BRIDGE_WEBSOCKET_PORT}`);
console.log(`Attempting to connect to controller at ${CONTROLLER_IP}:${CONTROLLER_PORT}`);

wss.on('connection', (ws) => {
    console.log('Frontend client connected to WebSocket bridge');
    let tcpClient = null;
    let KEEPALIVE_INTERVAL = 30000; // 30 seconds
    let keepAliveIntervalId = null;

    function connectToTcpController() {
        if (tcpClient && !tcpClient.destroyed) {
            console.log('TCP connection already active or connecting.');
            return tcpClient;
        }

        const client = new net.Socket();
        client.setTimeout(5000); // 5 seconds timeout for connection

        client.connect(CONTROLLER_PORT, CONTROLLER_IP, () => {
            console.log(`Connected to TCP controller: ${CONTROLLER_IP}:${CONTROLLER_PORT}`);
            tcpClient = client;
            ws.send(JSON.stringify({ type: 'bridge_status', message: 'Connected to TCP controller' }));
            
            // Start sending keep-alive messages if controller requires them
            // Example: send a newline or a specific keep-alive command
            if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
            keepAliveIntervalId = setInterval(() => {
                if (tcpClient && !tcpClient.destroyed && tcpClient.writable) {
                    // Adjust this to what your controller expects as a keep-alive
                    // For example, some devices expect a newline regularly
                    // tcpClient.write('\n'); 
                    // console.log('Sent TCP keep-alive');
                }
            }, KEEPALIVE_INTERVAL);
        });

        client.on('data', (data) => {
            const response = data.toString();
            console.log(`Received from TCP controller: ${response}`);
            try {
                // Attempt to parse as JSON, if not, send as raw string
                const jsonData = JSON.parse(response);
                ws.send(JSON.stringify(jsonData));
            } catch (e) {
                ws.send(JSON.stringify({ type: 'raw_data', data: response }));
            }
        });

        client.on('close', () => {
            console.log('TCP connection closed');
            if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
            keepAliveIntervalId = null;
            tcpClient = null;
            if (ws.readyState === WebSocket.OPEN) {
                 ws.send(JSON.stringify({ type: 'bridge_status', message: 'TCP connection closed. Attempting to reconnect...' }));
            }
            // Optional: auto-reconnect logic for TCP
            // setTimeout(connectToTcpController, 5000); 
        });

        client.on('error', (err) => {
            console.error(`TCP connection error: ${err.message}`);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'bridge_error', message: `TCP Error: ${err.message}` }));
            }
            if (tcpClient) tcpClient.destroy();
            tcpClient = null;
             if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
            keepAliveIntervalId = null;
        });
        
        client.on('timeout', () => {
            console.error('TCP connection timeout.');
            if (ws.readyState === WebSocket.OPEN) {
                 ws.send(JSON.stringify({ type: 'bridge_error', message: 'TCP connection timeout.' }));
            }
            if (tcpClient) client.destroy();
            tcpClient = null;
            if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
            keepAliveIntervalId = null;
        });
        return client;
    }
    
    // Initial connection attempt
    tcpClient = connectToTcpController();

    ws.on('message', (message) => {
        const messageString = message.toString();
        console.log(`Received from frontend: ${messageString}`);

        if (!tcpClient || tcpClient.destroyed) {
            console.log('TCP client not connected. Attempting to reconnect...');
            ws.send(JSON.stringify({ type: 'bridge_status', message: 'TCP client not connected. Reconnecting...' }));
            tcpClient = connectToTcpController(); // Attempt to reconnect
            // Defer sending message until TCP is connected, or queue it
            // For simplicity, we'll just notify and the user might need to retry
            if (!tcpClient || tcpClient.destroyed) {
                 ws.send(JSON.stringify({ type: 'bridge_error', message: 'Failed to connect to TCP controller. Please try again.' }));
                 return;
            }
        }
        
        // Assuming the message from frontend is a JSON string that the TCP controller understands
        // or that the bridge doesn't need to transform.
        // For protobuf, this part would need to serialize the JSON to a protobuf binary.
        // For now, sending as string.
        if (tcpClient && !tcpClient.destroyed && tcpClient.writable) {
            tcpClient.write(messageString + '\\n'); // Append newline if controller expects line-terminated commands
            console.log(`Sent to TCP controller: ${messageString}`);
        } else {
             console.log('Cannot send message, TCP client not writable.');
             if(ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'bridge_error', message: 'Cannot send command: TCP client not ready.' }));
             }
        }
    });

    ws.on('close', () => {
        console.log('Frontend client disconnected from WebSocket bridge');
        if (tcpClient && !tcpClient.destroyed) {
            tcpClient.destroy();
            console.log('TCP connection closed due to WebSocket client disconnect.');
        }
        if (keepAliveIntervalId) clearInterval(keepAliveIntervalId);
    });

    ws.on('error', (err) => {
        console.error(`WebSocket error for a client: ${err.message}`);
        // TCP client cleanup is handled by ws.on('close') if that also triggers
    });
});

console.log('Bridge setup complete.');
