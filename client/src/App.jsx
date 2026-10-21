import React, { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5000';

const LANGUAGES = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'Java', value: 'java' },
  { label: 'C++', value: 'cpp' }
];

export default function App() {
  const [roomId, setRoomId] = useState('main-room');
  const [inputRoomId, setInputRoomId] = useState('');
  const [code, setCode] = useState('// Welcome to Real-Time Collaborative Code Editor!\n// Enter a Room ID or click Create Room to collaborate.\n\nfunction main() {\n  console.log("Hello, World!");\n}\n\nmain();\n');
  const [language, setLanguage] = useState('javascript');
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [statusMessage, setStatusMessage] = useState('Ready');

  const socketRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const currentRoomRef = useRef(roomId);

  useEffect(() => {
    currentRoomRef.current = roomId;
  }, [roomId]);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setStatusMessage('Connected to server');
      // Automatically join initial room
      joinRoomById(roomId, socket);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setStatusMessage('Disconnected from server');
    });

    socket.on('code-update', (data) => {
      if (data && typeof data.code === 'string') {
        isRemoteUpdateRef.current = true;
        setCode(data.code);
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 50);
      }
    });

    socket.on('language-update', (data) => {
      if (data && data.language) {
        setLanguage(data.language);
      }
    });

    socket.on('user-count-update', (data) => {
      if (data && typeof data.userCount === 'number') {
        setUserCount(data.userCount);
      }
    });

    socket.on('save-notification', (data) => {
      setStatusMessage(`Saved to saved-code.json at ${data.timestamp}`);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoomById = (targetRoomId, activeSocket = socketRef.current) => {
    const cleanId = (targetRoomId || '').trim();
    if (!cleanId) return;

    if (activeSocket && activeSocket.connected) {
      activeSocket.emit('join-room', { roomId: cleanId }, (res) => {
        if (res && res.success) {
          setRoomId(cleanId);
          setCode(res.code || '');
          if (res.language) setLanguage(res.language);
          if (res.userCount) setUserCount(res.userCount);
          setStatusMessage(`Joined room "${cleanId}"`);
        }
      });
    }
  };

  const handleCreateRoom = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('create-room', (res) => {
        if (res && res.roomId) {
          setRoomId(res.roomId);
          setInputRoomId(res.roomId);
          joinRoomById(res.roomId);
        }
      });
    }
  };

  const handleJoinRoom = (e) => {
    if (e) e.preventDefault();
    if (!inputRoomId.trim()) return;
    joinRoomById(inputRoomId.trim());
  };

  const handleCodeChange = (newVal) => {
    const updated = newVal || '';
    setCode(updated);

    // If change came from remote socket broadcast, don't re-emit
    if (isRemoteUpdateRef.current) {
      return;
    }

    setStatusMessage('Editing...');

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('code-change', {
        roomId: currentRoomRef.current,
        code: updated
      });
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('language-change', {
        roomId: currentRoomRef.current,
        language: newLang
      });
    }
  };

  const handleSaveCode = () => {
    if (socketRef.current && socketRef.current.connected) {
      setStatusMessage('Saving code to disk...');
      socketRef.current.emit(
        'save-code',
        {
          roomId,
          code,
          language
        },
        (res) => {
          if (res && res.success) {
            setStatusMessage(`Saved to saved-code.json at ${res.timestamp}`);
          } else {
            setStatusMessage('Failed to save code');
          }
        }
      );
    }
  };

  const handleClearCode = () => {
    if (window.confirm('Are you sure you want to clear the editor?')) {
      setCode('');
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('clear-code', { roomId });
      }
      setStatusMessage('Editor cleared');
    }
  };

  return (
    <div className="app">
      {/* 1. Header Bar */}
      <header className="header">
        <div className="header-title">
          <span className="logo-icon">&#128187;</span>
          <h1>Real-Time Collaborative Code Editor</h1>
        </div>

        {/* Room Controls: Input, Join, Create */}
        <div className="room-controls">
          <form onSubmit={handleJoinRoom} className="room-form">
            <input
              type="text"
              placeholder="Enter Room ID..."
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              className="room-input"
            />
            <button type="submit" className="btn btn-secondary">
              Join Room
            </button>
          </form>

          <button onClick={handleCreateRoom} className="btn btn-primary">
            + Create Room
          </button>
        </div>
      </header>

      {/* 2. Editor Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="info-badge">
            <span className="info-label">Room:</span>
            <span className="info-value">{roomId}</span>
          </div>

          <div className="info-badge">
            <span className="info-label">Users in room:</span>
            <span className="info-value">{userCount}</span>
          </div>

          {/* Connection Status */}
          <div className="status-badge">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Language Selector */}
          <div className="language-selector">
            <label htmlFor="lang-select">Language:</label>
            <select
              id="lang-select"
              value={language}
              onChange={handleLanguageChange}
              className="select-input"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Save Code Button */}
          <button onClick={handleSaveCode} className="btn btn-save" title="Save code to saved-code.json">
            &#128190; Save Code
          </button>

          {/* Clear Code Button */}
          <button onClick={handleClearCode} className="btn btn-clear" title="Clear current editor code">
            &#128465; Clear Code
          </button>
        </div>
      </div>

      {/* 3. Main Monaco Editor Container */}
      <div className="editor-container">
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          theme="vs-dark"
          onChange={handleCodeChange}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            fontFamily: "'Courier New', Courier, monospace"
          }}
        />
      </div>

      {/* 4. Footer Status Bar */}
      <footer className="footer-status">
        <span className="status-text">{statusMessage}</span>
        <span className="footer-meta">Localhost Collaborative Code Editor &bull; Port 5000</span>
      </footer>
    </div>
  );
}
