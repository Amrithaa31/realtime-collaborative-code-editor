# Real-Time Collaborative Code Editor (Localhost)

A simple, fast, full-stack collaborative code editor that runs entirely on your local computer using `localhost`. Multiple users can join the same coding room, edit code concurrently with real-time updates via Socket.IO, change programming languages, and save their work directly to a local JSON file.

No cloud hosting, no accounts, no login required. The application opens directly to the code editor.

---

## 1. Features

- **Direct Access:** Opens straight into the editor with zero authentication, login, or registration friction.
- **Room Management:** Create unique rooms or enter any custom Room ID to join the same shared editing session.
- **Real-Time Synchronization:** Concurrent edits made in one tab appear automatically in all other tabs in that room with minimal latency.
- **Infinite Loop Prevention:** Internal update flags ensure socket broadcasts do not bounce back and forth recursively.
- **Room Isolation:** Different Room IDs remain strictly isolated; edits in Room A are never seen in Room B.
- **Monaco Code Editor:** Syntax highlighting, line numbers, and clean dark theme (`vs-dark`).
- **Language Support:** Switch between **JavaScript, Python, Java, and C++** dynamically across all participants.
- **Local Persistence:** Click **Save Code** to save the room's code and language into `server/saved-code.json`. Rejoining or refreshing the room restores the saved document.
- **Clear Code:** Clean button to wipe the workspace with confirmation.
- **Live Presence & Status:** Shows connection indicator (Connected / Disconnected) and count of active users in the room.

---

## 2. Technology Stack

- **Frontend:**
  - React.js (v18)
  - Vite
  - Monaco Editor (`@monaco-editor/react`)
  - Socket.IO Client
  - Normal, clean CSS
- **Backend:**
  - Node.js
  - Express.js (Port 5000)
  - Socket.IO Server (Port 5000)
  - Local JSON storage (`server/saved-code.json`)

---

## 3. Project Structure

```
realtime-collaborative-code-editor/
├── package.json              # Root project scripts
├── README.md                 # Complete setup and testing guide
├── client/                   # Frontend React + Vite application
│   ├── index.html            # Entry HTML
│   ├── package.json          # Frontend dependencies
│   ├── vite.config.js        # Vite config (runs on http://localhost:5173)
│   └── src/
│       ├── App.jsx           # Main Collaborative Editor component
│       ├── index.css         # Styling for header, toolbar, badges, and editor
│       └── main.jsx          # React DOM entry point
└── server/                   # Backend Node.js Express + Socket.IO server
    ├── package.json          # Backend dependencies
    ├── saved-code.json       # Local file storage for persistent rooms
    ├── server.js             # Express API & Socket.IO room coordination
    └── test-local.js         # Automated end-to-end test script
```

---

## 4. Installation

Clone or open the project folder in your terminal:

```bash
cd realtime-collaborative-code-editor
```

### 1. Install Backend Dependencies
```bash
cd server
npm install
cd ..
```

### 2. Install Frontend Dependencies
```bash
cd client
npm install
cd ..
```

---

## 5. Starting the Application

You can start the backend and frontend using two separate terminal windows.

### Terminal 1 — Start Backend Server (Port 5000)
```bash
cd server
npm start
```
*Output:*
```
Collaborative Code Editor Server running locally on http://localhost:5000
Saved code storage: .../server/saved-code.json
```

### Terminal 2 — Start Frontend Application (Port 5173)
```bash
cd client
npm run dev
```
*Output:*
```
  VITE v5.x.x  ready in 200 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 6. How to Test Real-Time Collaboration

Follow this test to verify real-time collaboration on your computer:

1. **Open Tab 1:**
   - In your browser (e.g. Chrome), open:
     `http://localhost:5173`
   - Notice the connection badge says **Connected** (green dot).
   - The editor loads with the default room (`main-room`).

2. **Open Tab 2:**
   - In a second tab or separate window, open:
     `http://localhost:5173`
   - Both tabs are now in `main-room` and show **Users in room: 2**.

3. **Test Real-Time Editing:**
   - Type code in Tab 1 (e.g. `console.log("Hello from Tab 1!");`).
   - Look at Tab 2: The code appears automatically in real-time without refreshing!
   - Now type in Tab 2: The change reflects in Tab 1 immediately.

4. **Test Language Switching:**
   - In Tab 1, change the **Language** dropdown from `JavaScript` to `Python`.
   - In Tab 2, the language updates to `Python` and syntax highlighting changes accordingly.

5. **Test Creating & Joining a Custom Room:**
   - In Tab 1, click **+ Create Room**. A new Room ID (e.g. `room-k8f9a2`) is generated and joined.
   - Copy or note the new Room ID.
   - In Tab 2, paste that Room ID into the top input box and click **Join Room**.
   - Both tabs are now connected to the new room, completely isolated from `main-room`.

6. **Test Saving Code Locally:**
   - Type some code in the room.
   - Click **💾 Save Code**.
   - The status bar displays `Saved to saved-code.json at <time>`.
   - Open `server/saved-code.json` in your file explorer or text editor: your code is physically saved to your hard drive!
   - Refresh both browser tabs: the room reloads with your saved code restored.

7. **Test Clear Code:**
   - Click **🗑️ Clear Code** and confirm.
   - The editor clears in all tabs connected to that room.

---

## 7. Automated Testing

You can run the built-in test script to verify that the backend, WebSockets, room isolation, and JSON persistence are working:

```bash
cd server
npm test
```

Expected output:
```
  ✓ Health check (GET /api/health)
  ✓ Socket.IO Connection & Join Room
  ✓ Real-Time Code Sync between two clients
  ✓ Language Sync across room clients
  ✓ Room Isolation (Different rooms do not share updates)
  ✓ Save Code to disk (saved-code.json)

TEST SUMMARY: 6 PASSED, 0 FAILED
```
