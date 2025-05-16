# HotelKey - Smart Hotel Management (with Real Controller Integration)

This project is a Next.js application for managing hotel room bookings and interacting with a room controller via a WebSocket-to-TCP bridge.

## Project Structure

HotelKey/ (Project Root)
├── .env                       # Environment variables (controller IP, ports)
├── file.proto                 # Protobuf definitions for controller communication
├── package.json               # Project dependencies and scripts
├── README.txt                 # This file
├── next.config.ts
├── tsconfig.json
├── components.json
├── tailwind.config.ts
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Main booking page
│   │   ├── admin/             # Admin dashboard
│   │   └── room/
│   │       └── [id]/
│   │           └── page.tsx   # Room control page that uses the bridge
│   ├── components/            # React components (UI, layout, auth, room controls)
│   ├── hooks/                 # Custom React hooks (use-room-controller.ts, etc.)
│   ├── lib/                   # Utility functions, etc.
│   ├── server/
│   │   └── bridge.js          # Node.js WebSocket-to-TCP bridge server
│   ├── store/                 # Zustand stores (useStore.ts for hotel, controllerStore.ts for direct UI)
│   └── types/                 # TypeScript type definitions (hotel.ts, protobuf.ts)
└── public/                    # Static assets (icons, manifest.json)

## Prerequisites

1.  **Node.js and npm/yarn**: Ensure you have Node.js (v18 or later recommended) and a package manager (npm or yarn) installed.
2.  **Hardware Controller**: A physical controller accessible on your network at the IP and port specified in the `.env` file, which communicates using the Protobuf protocol defined in `file.proto` (length-prefixed messages).
3.  **Git**: For cloning the repository if applicable.

## Setup Instructions

1.  **Clone the Repository (if applicable)**:
    ```bash
    # git clone <repository_url>
    # cd HotelKey 
    ```

2.  **Install Dependencies**:
    Navigate to the project root directory (`HotelKey/`) in your terminal and run:
    ```bash
    npm install
    ```
    or if you use yarn:
    ```bash
    yarn install
    ```
    This will install all frontend dependencies specified in `package.json` and backend dependencies for the bridge (`ws`, `dotenv`, `protobufjs`).

3.  **Configure Environment Variables**:
    Create a file named `.env` in the project root directory (`HotelKey/`).
    Copy the following content into it and **modify the values** to match your environment:

    ```env
    CONTROLLER_IP=192.168.1.100
    CONTROLLER_PORT=7000
    BRIDGE_WEBSOCKET_PORT=8080
    TCP_TIMEOUT_MS=5000

    # Optional: For frontend if bridge runs on a different host/port than the dev server
    # NEXT_PUBLIC_BRIDGE_HOST=localhost
    # NEXT_PUBLIC_BRIDGE_PORT=8080
    ```
    *   `CONTROLLER_IP`: The IP address of your hardware controller.
    *   `CONTROLLER_PORT`: The TCP port your hardware controller listens on.
    *   `BRIDGE_WEBSOCKET_PORT`: The port the Node.js bridge server will use for WebSocket connections from the frontend.
    *   `TCP_TIMEOUT_MS`: Timeout in milliseconds for TCP connection attempts to the controller (used by `bridge.js`).
    *   `NEXT_PUBLIC_BRIDGE_HOST` and `NEXT_PUBLIC_BRIDGE_PORT`: If your Next.js dev server (e.g., `localhost:9002`) is different from where the bridge will run (e.g., `localhost:8080`), you might need these for the frontend to correctly connect to the bridge. If they are the same host and the bridge runs on port 8080, the defaults in `use-room-controller.ts` should work.

4.  **Verify `file.proto`**:
    Ensure the `file.proto` file is present in the project root directory. This file is crucial for the `bridge.js` server to understand the communication protocol with the hardware controller.

## Running the Application

You need to run two separate processes: the **Backend Bridge Server** and the **Frontend Application**.

### Step 1: Start the Backend Bridge Server

1.  Open a terminal in the project root directory (`HotelKey/`).
2.  Run the following command:
    ```bash
    npm run bridge
    ```
    Alternatively, you can run it directly:
    ```bash
    node src/server/bridge.js
    ```
3.  You should see log messages indicating that the bridge server has started and is trying to load Protobuf definitions:
    ```
    Protobuf definitions loaded successfully.
    WebSocket Bridge server started on ws://localhost:8080
    Attempting to connect to controller at <CONTROLLER_IP>:<CONTROLLER_PORT>
    Bridge setup complete. Waiting for WebSocket connections.
    ```
    Keep this terminal window open. The bridge server needs to be running for the frontend to communicate with the controller.

### Step 2: Start the Frontend Application

1.  Open a **new** terminal window in the project root directory (`HotelKey/`).
2.  Run the following command:
    ```bash
    npm run dev
    ```
3.  This will start the Next.js development server, typically on `http://localhost:9002` (as per your `package.json` dev script). The terminal will show output like:
    ```
    ✓ Ready in x.xxs
    ○ Compiling / ...
    ✓ Compiled / in x.xxs
    ```

### Step 3: Using the Application

1.  **Login & Book a Room (Main Hotel App Flow)**:
    *   Open your web browser and navigate to `http://localhost:9002`.
    *   Log in (e.g., `guest@hotel.key` / `guest`). This step is important because it generates an `authToken` in the `useHotelStore` after a successful booking.
    *   Book a room. This action will:
        *   Create a booking.
        *   Associate the booked `roomId` with your user.
        *   Generate and store an `authToken` specific to this booking in the `useHotelStore`.

2.  **Access the Room Control Page**:
    *   After booking, you should be redirected to the room control page, e.g., `http://localhost:9002/room/101` (if you booked room 101).
    *   Alternatively, if you are already logged in and have a current booking, the "My Room" link in the header should take you there.

3.  **Interact with the Controller**:
    *   On the room control page (`/room/[id]`), you will see the "Состояние комнаты (Прямое управление)" panel.
    *   Click the **"Подключиться к контроллеру (Комната X)"** button. This will:
        *   Attempt to establish a WebSocket connection to the bridge server (`ws://localhost:8080`).
        *   The `useRoomController` hook will use the `authToken` (from `useHotelStore`) and `roomId` (from the URL) for communications.
        *   Upon successful connection, it will send a `get_info` command to the controller via the bridge.
    *   **Controller Information**: If `get_info` is successful, the IP, MAC, BLE Name, and Token of the controller (as returned by the controller itself) will be displayed. Example: IP: `192.168.1.100`, MAC: `FE:E8:C0:D4:57:14`, BLE Name: `ROOM_7`, Token: `CM6wqJB5blIMvBKQ`.
    *   **Room State**: The panel will periodically request and display the current state of the room (light, door, channels, sensors).
    *   **Controls**: Use the switches and buttons (Light, Door, Channel 1, Channel 2) to send `set_state` commands to the controller.
    *   **Status & Errors**:
        *   Connection status (Disconnected, Connecting, Connected, Error) will be shown.
        *   Toasts will provide feedback on command success/failure.
        *   Errors from the bridge or controller will be displayed.

## Troubleshooting

*   **Bridge not starting**:
    *   Check for errors in the bridge terminal.
    *   Ensure `file.proto` is in the project root.
    *   Ensure `protobufjs` is installed (`npm list protobufjs`).
    *   Ensure `.env` file is correctly configured and accessible.
*   **Frontend cannot connect to bridge**:
    *   Verify the bridge is running and listening on the correct port (e.g., `ws://localhost:8080`).
    *   Check browser console (F12) for WebSocket connection errors.
    *   Ensure `BRIDGE_WEBSOCKET_PORT` in `.env` matches the port the bridge is using AND the port the frontend tries to connect to (defaults to 8080 in `use-room-controller.ts` or configurable via `NEXT_PUBLIC_BRIDGE_PORT`).
*   **No data from controller / Commands don't work**:
    *   Check the bridge terminal logs. It shows messages sent to and received from the TCP controller, including Protobuf encoding/decoding steps.
    *   Verify `CONTROLLER_IP` and `CONTROLLER_PORT` in `.env` are correct and the controller is reachable from where the bridge is running.
    *   Ensure the controller is powered on and functioning.
    *   The controller must respond with length-prefixed Protobuf messages as expected by `bridge.js`.
    *   If the controller expects a different command format (not JSON transformed to Protobuf as per `file.proto` by the bridge), the `bridge.js` logic for encoding/decoding TCP messages will need adjustment.
*   **Authentication Issues**:
    *   The current setup relies on `useHotelStore` to provide an `authToken` after booking. Ensure you have completed the booking flow.
    *   The bridge currently does not perform strict JWT validation but forwards the token. If your controller or a future version of the bridge requires strict validation, this will need to be implemented.

This setup provides a full-stack interaction from your Next.js frontend to your hardware controller via the Node.js bridge.
