# CodeTogether — Real-Time Collaborative Code Editor

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Demo-black?logo=vercel)](https://realtime-collaborative-code-editor-sable-five.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Amrithaa31-181717?logo=github)](https://github.com/Amrithaa31/realtime-collaborative-code-editor)

* **Live Vercel Application:** [https://realtime-collaborative-code-editor-sable-five.vercel.app](https://realtime-collaborative-code-editor-sable-five.vercel.app)
* **GitHub Repository:** [https://github.com/Amrithaa31/realtime-collaborative-code-editor](https://github.com/Amrithaa31/realtime-collaborative-code-editor)

A full-stack, browser-based collaborative coding application built using **React**, **Node.js**, **Express**, and **Socket.IO**. It allows multiple developers or students to create coding rooms, share a Room ID, write code together, and view synchronized updates in real time with zero page refreshes.

---

## 1. Problem Statement

When students or developers collaborate remotely on assignments, algorithmic problem solving, or code reviews, sharing screen streams or repeatedly copying and pasting snippets over messaging apps is tedious, error-prone, and slow. 

Existing commercial solutions (like Google Docs or advanced cloud IDEs) are often heavy, bloated, require account registrations, or use complicated setups. There is a need for a lightweight, beginner-friendly, and instantaneous collaborative code editor where users can open a browser, create a room, and immediately start writing code together.

---

## 2. Project Objectives

The primary objectives of this Full Stack Development (FSD) project are:
1. **Real-Time Code Synchronization:** Broadcast code edits across all connected users in a room with near-zero latency using WebSockets.
2. **Room-Based Isolation:** Enable multiple pairs or groups of users to work independently in isolated rooms without cross-room interference.
3. **Beginner-Friendly Architecture:** Keep the stack clean, educational, and easy to explain line-by-line during a college viva or project review.
4. **No Authentication Friction:** Allow users to instantly create or join rooms without mandatory logins or passwords.
5. **Multi-Language Support & Starter Templates:** Provide starter code for popular academic languages (JavaScript, Python, Java, C, and HTML).
6. **Room Management & Presence:** Show live participant counts and dynamic user lists (e.g., User 1, User 2) that update in real time when users join or leave.

---

## 3. Technology Stack

This project strictly adheres to fundamental full-stack web technologies:

### Frontend
- **HTML5:** Semantic document structure and textarea elements.
- **CSS3:** Responsive dark theme, flexbox, CSS grid, and custom scrollbars (no heavy styling frameworks like Tailwind or Bootstrap).
- **JavaScript (ES6+):** Modern JavaScript for state logic and event handling.
- **React (via Vite):** Functional components and React Hooks (`useState`, `useEffect`, `useRef`).
- **Socket.IO Client (`socket.io-client`):** WebSocket client library for real-time bidirectional events.

### Backend
- **Node.js:** JavaScript runtime environment for backend execution.
- **Express.js:** Lightweight web framework for HTTP endpoints and middleware handling.
- **Socket.IO:** Real-time event-driven engine managing WebSocket connections, rooms, and broadcasts.
- **CORS:** Cross-Origin Resource Sharing middleware enabling secure communication between Vite (`localhost:5173`) and Express (`localhost:5000`).

### In-Memory Storage
- JavaScript `Map` data structures stored in backend memory (`rooms`).
- *No database is required.* All rooms, participants, code, and language states exist in the server process memory during runtime.

---

## 4. Key Features

- **Instant Room Creation:** Generates a clean, unique 6-character Room ID (e.g., `room-a3x9f2`) and initializes starter code.
- **Secure Room Joining:** Validates Room ID existence before allowing a user to join, giving clear user-facing error messages if a room is not found.
- **Bi-directional Live Synchronization:** Every keystroke typed in one tab or device immediately updates all other collaborators in that room.
- **Infinite Loop Prevention:** Uses a remote-update flag (`isRemoteUpdateRef`) to ensure received code updates do not trigger reciprocal broadcasts.
- **Tab Key Indentation:** Pressing `Tab` inside the code editor inserts 2 spaces without losing cursor focus.
- **Language Selector:** Switch between JavaScript, Python, Java, C, and HTML.
- **Reset Code:** Restores the starter template for the active language across all collaborators.
- **Clear Code:** Clears the editor canvas for all collaborators.
- **Active Participants Panel:** Displays active collaborators (`User 1 (You)`, `User 2`, etc.) with live presence dots.
- **One-Click Copy Room ID:** Copies the Room ID to clipboard with automatic fallback for older browsers and visual "✓ Copied!" feedback.
- **Status Bar:** Displays room ID, participant count, server connection state (`Connected` / `Disconnected`), and synchronization feedback.
- **Automatic Room Cleanup:** When all participants leave a room or disconnect, the room is safely deleted from memory to free server resources.

---

## 5. System Architecture

```
+-------------------------------------------------------------------+
|                        Client 1 (Browser)                         |
|   React (Vite) + Plain CSS + HTML Textarea + Socket.IO Client     |
+---------------------------------+---------------------------------+
                                  |
               WebSocket Events   |   (code-change, join-room, etc.)
                                  v
+-------------------------------------------------------------------+
|                     Backend Server (Node.js)                      |
|                  Express + Socket.IO (Port 5000)                  |
|                                                                   |
|   In-Memory Storage:                                              |
|   rooms = Map {                                                   |
|     'room-xyz' => {                                               |
|        code: string,                                              |
|        language: 'javascript',                                    |
|        participants: Map { socketId => { username } }             |
|     }                                                             |
|   }                                                               |
+---------------------------------+---------------------------------+
                                  |
               WebSocket Events   |   (code-updated, participants)
                                  v
+-------------------------------------------------------------------+
|                        Client 2 (Browser)                         |
|   React (Vite) + Plain CSS + HTML Textarea + Socket.IO Client     |
+-------------------------------------------------------------------+
```

### How Socket.IO Enables Real-Time Collaboration
1. **Connection Handshake:** When the user opens the application, `socket.io-client` establishes a persistent, bi-directional WebSocket connection with the Express server.
2. **Room Subscription:** When a user creates or joins a room, the server executes `socket.join(roomId)`. Socket.IO internally maps that socket ID to that specific room channel.
3. **Targeted Broadcasting:** When User 1 types code, the client emits `code-change` with `{ roomId, code }`. The server validates that User 1 is indeed in `roomId`, updates the in-memory room code, and broadcasts `code-updated` via `socket.to(roomId).emit(...)`.
   - The `.to(roomId)` ensures only users in the same room receive the update.
   - Using `socket.to(...)` instead of `io.to(...)` sends the payload to everyone *except* the sender, avoiding cursor jumps and infinite event loops.
4. **Presence Lifecycle:** When a socket disconnects, the server's `disconnect` event listener removes the socket from the participants map and emits `participants-updated` to remaining members. If the room is empty, it is deleted.

---

## 6. Project Folder Structure

```
codetogether/
├── client/                      # Frontend Application (React + Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Header, Room ID display, copy & leave buttons
│   │   │   ├── Home.jsx         # Landing page (Create & Join room forms, features)
│   │   │   ├── Editor.jsx       # Textarea editor, language dropdown, clear/reset, statusbar
│   │   │   └── Participants.jsx # Active collaborators list & presence
│   │   ├── App.jsx              # Main App component & Socket.IO state management
│   │   ├── main.jsx             # React DOM entry point
│   │   └── index.css            # Dark theme styles & responsive CSS
│   ├── index.html               # Main HTML entry file
│   ├── package.json             # Frontend dependencies & Vite scripts
│   └── vite.config.js           # Vite dev server configuration
├── server/                      # Backend Server (Node.js + Express + Socket.IO)
│   ├── server.js                # Express app, Socket.IO handlers, in-memory rooms
│   ├── test-realtime.js         # Automated end-to-end socket testing script
│   └── package.json             # Backend dependencies & start scripts
├── package.json                 # Root package helper scripts
└── README.md                    # Comprehensive documentation
```

---

## 7. Installation & Setup Instructions

### Prerequisites
- **Node.js** (v18.x or newer installed on your machine)
- **npm** (comes bundled with Node.js)
- A modern web browser (Chrome, Edge, Firefox, or Brave)

### Step 1: Clone or Navigate to the Project Folder
Open your terminal or command prompt:
```bash
cd codetogether
```

### Step 2: Install Backend Dependencies
Navigate to the `server` directory and install the packages:
```bash
cd server
npm install
```
*(On Windows PowerShell, use `npm.cmd install` if script execution policies apply)*

### Step 3: Install Frontend Dependencies
Open a separate terminal window or return to root, navigate to the `client` directory, and install the packages:
```bash
cd ../client
npm install
```

---

## 8. Running the Application

### 1. Start the Backend Server
In your first terminal (inside the `server` directory):
```bash
npm start
```
The server will start listening on:
`http://localhost:5000`

### 2. Start the Frontend Development Server
In your second terminal (inside the `client` directory):
```bash
npm run dev
```
Vite will launch the local web server at:
`http://localhost:5173`

---

## 9. How to Test Real-Time Collaboration

Follow this step-by-step workflow:

1. Open your browser and navigate to **`http://localhost:5173`**.
2. **Tab 1 (Creator):**
   - In the "Create New Room" card, enter your name (e.g., *Alice*) or leave it blank.
   - Click **Create Room**.
   - You will be redirected to the editor workspace with a newly generated Room ID (e.g., `room-k9m2p4`).
   - Click the **📋 Copy Room ID** button in the top navigation bar.
3. **Tab 2 (Collaborator):**
   - Open a second browser tab (or Incognito window) and navigate to **`http://localhost:5173`**.
   - In the "Join Existing Room" card, paste the Room ID and enter your name (e.g., *Bob*).
   - Click **Join Room**.
4. **Verify Real-Time Synchronization:**
   - Both tabs now show the same code editor and display **Active Users (2)** in the sidebar with *Alice* and *Bob*.
   - Start typing code in Tab 1; observe Tab 2 updating simultaneously in real time.
   - Type code in Tab 2; observe Tab 1 updating instantly.
   - Try the **Language Selector**, **Reset Code**, and **Clear Code** buttons to observe synchronized changes.
   - Close Tab 2; observe Tab 1 updating its participant count to 1 immediately.

### Running Automated Test Suite
An automated verification test script is included to validate the entire backend and Socket.IO engine:
```bash
cd server
node test-realtime.js
```
This tests:
- HTTP health endpoint
- Room creation and unique ID generation
- Nonexistent room validation & error responses
- Multi-client joining & participant notifications
- Bidirectional code synchronization
- Room isolation (preventing cross-room leaks)
- Clear Code and Reset Code synchronization
- Disconnection cleanup

---

## 10. Limitations & Future Enhancements

### Limitations
1. **In-Memory Storage:** All rooms and active code are held in the server's JavaScript memory. If the backend server restarts, active rooms and unsaved code will be reset.
2. **Concurrent Cursor Tracking:** The editor uses standard HTML `<textarea>`. While code updates synchronize instantly, individual colored user cursors or selection highlights are not rendered.
3. **No Execution Sandbox:** Code is synchronized and displayed with syntax-friendly styling, but code execution (running programs on the server) is omitted to keep the project secure, lightweight, and focused on real-time communication.

### Future Enhancements
- **Persistent Storage:** Integrate MongoDB or SQLite to persist rooms and revision history across server restarts.
- **Operational Transformation (OT) or CRDTs:** Implement Yjs or Automerge for granular character-by-character conflict resolution during simultaneous high-speed typing.
- **Audio/Video Chat:** Integrate WebRTC for peer-to-peer audio calls alongside coding.
- **Code Execution Container:** Add Docker or WebAssembly-based code runners (e.g., Pyodide) to execute code directly in the browser safely.

---

## 11. Viva & Review Summary

| Question | Answer |
| :--- | :--- |
| **Why WebSockets instead of HTTP polling?** | HTTP polling requires repeated request-response cycles with header overhead and delay. WebSockets maintain a persistent, low-overhead TCP connection allowing the server to push code edits to clients instantly. |
| **How do rooms work?** | Socket.IO provides a built-in `socket.join(roomId)` feature. Broadcasts sent with `socket.to(roomId).emit(...)` are routed only to sockets subscribed to that specific room channel. |
| **How is an infinite update loop avoided?** | When a client receives `code-updated` from the server, a ref flag (`isRemoteUpdateRef`) is set to `true`. The editor's `onChange` checks this flag and skips emitting `code-change` back to the server. |
| **Where is the data stored?** | In-memory inside JavaScript `Map` objects on the Node.js server. |
