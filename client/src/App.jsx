import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar.jsx';
import Home from './components/Home.jsx';
import Editor from './components/Editor.jsx';
import Participants from './components/Participants.jsx';
import ServerModal from './components/ServerModal.jsx';

/**
 * Determine the initial backend WebSocket URL:
 * 1. Saved preference in localStorage
 * 2. Vite environment variable VITE_BACKEND_URL
 * 3. Default localhost port 5000 if running locally
 * 4. Fallback default
 */
function getInitialBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  const saved = localStorage.getItem('codetogether_backend_url');
  if (saved && saved.trim()) return saved.trim();

  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  // If on localhost or 127.0.0.1, use local server
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // When deployed to Vercel without an env var, default to localtunnel or localhost
  return 'http://localhost:5000';
}

export default function App() {
  // Navigation View: 'home' | 'editor'
  const [currentView, setCurrentView] = useState('home');

  // Backend connection URL
  const [backendUrl, setBackendUrl] = useState(getInitialBackendUrl);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  // Room & User State
  const [roomId, setRoomId] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [participants, setParticipants] = useState([]);

  // Network & UI Feedback
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Ready');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs for socket instance and avoiding infinite update loops
  const socketRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const currentRoomRef = useRef(roomId);

  useEffect(() => {
    currentRoomRef.current = roomId;
  }, [roomId]);

  // Handle Backend URL Update
  const handleUpdateBackendUrl = (newUrl) => {
    const cleanUrl = (newUrl || '').trim();
    if (!cleanUrl) return;
    localStorage.setItem('codetogether_backend_url', cleanUrl);
    setBackendUrl(cleanUrl);
    setErrorMessage('');
  };

  // Initialize and maintain Socket.IO connection whenever backendUrl changes
  useEffect(() => {
    if (!backendUrl) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    console.log(`Connecting Socket.IO to backend: ${backendUrl}`);
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to backend server with Socket ID:', socket.id);
      setIsConnected(true);
      setSyncStatus('Connected to server');
      setErrorMessage('');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from backend server');
      setIsConnected(false);
      setSyncStatus('Disconnected from server');
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      console.warn('Socket connect_error:', err.message);
    });

    // Remote Code Update received from server
    socket.on('code-updated', (data) => {
      if (data && typeof data.code === 'string') {
        // Mark as remote update so our onChange handler does NOT re-emit this change
        isRemoteUpdateRef.current = true;
        setCode(data.code);

        if (data.action === 'cleared') {
          setSyncStatus('Editor was cleared by another user');
        } else if (data.action === 'reset') {
          setSyncStatus('Code was reset to starter template');
        } else {
          setSyncStatus('Code synchronized with room');
        }

        // Release remote flag after state update settles
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 50);
      }
    });

    // Remote Language Update
    socket.on('language-updated', (data) => {
      if (data && data.language) {
        setLanguage(data.language);
        setSyncStatus(`Language changed to ${data.language}`);
      }
    });

    // Participants list update
    socket.on('participants-updated', (data) => {
      if (data && Array.isArray(data.participants)) {
        setParticipants(data.participants);
        if (data.message) {
          setSyncStatus(data.message);
        }
      }
    });

    // Room-specific error event
    socket.on('room-error', (data) => {
      if (data && data.message) {
        setErrorMessage(data.message);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [backendUrl]);

  /**
   * Action: Create Room
   */
  const handleCreateRoom = (preferredName) => {
    if (!socketRef.current || !socketRef.current.connected) {
      setErrorMessage(`Cannot create room: Not connected to backend at ${backendUrl}. Click 'Server Settings' to check your connection.`);
      return;
    }

    setErrorMessage('');
    const username = (preferredName && preferredName.trim()) ? preferredName.trim() : 'User 1';

    socketRef.current.emit('create-room', { username }, (res) => {
      if (res && res.success) {
        setRoomId(res.roomId);
        setCurrentUser(res.username);
        setCode(res.code || '');
        setLanguage(res.language || 'javascript');
        setParticipants(res.participants || []);
        setCurrentView('editor');
        setSyncStatus(`Room created (${res.roomId})`);
      } else {
        setErrorMessage(res?.message || 'Failed to create room.');
      }
    });
  };

  /**
   * Action: Join Existing Room
   */
  const handleJoinRoom = (targetRoomId, preferredName) => {
    if (!socketRef.current || !socketRef.current.connected) {
      setErrorMessage(`Cannot join room: Not connected to backend at ${backendUrl}. Click 'Server Settings' to check your connection.`);
      return;
    }

    setErrorMessage('');
    const username = (preferredName && preferredName.trim()) ? preferredName.trim() : '';

    socketRef.current.emit('join-room', { roomId: targetRoomId, username }, (res) => {
      if (res && res.success) {
        setRoomId(res.roomId);
        setCurrentUser(res.username);
        setCode(res.code || '');
        setLanguage(res.language || 'javascript');
        setParticipants(res.participants || []);
        setCurrentView('editor');
        setSyncStatus(`Joined room ${res.roomId}`);
      } else {
        setErrorMessage(res?.message || `Could not join room "${targetRoomId}".`);
      }
    });
  };

  /**
   * Action: Code Edited locally by this user
   */
  const handleCodeChange = (newCode) => {
    setCode(newCode);

    // If this update was triggered by an incoming socket event, do not re-emit
    if (isRemoteUpdateRef.current) {
      return;
    }

    setSyncStatus('Synchronizing...');

    if (socketRef.current && socketRef.current.connected && currentRoomRef.current) {
      socketRef.current.emit('code-change', {
        roomId: currentRoomRef.current,
        code: newCode
      });
      // Short delay indicator
      setTimeout(() => {
        setSyncStatus('All changes synced');
      }, 300);
    }
  };

  /**
   * Action: Language Changed by this user
   */
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);

    if (socketRef.current && socketRef.current.connected && currentRoomRef.current) {
      socketRef.current.emit('language-change', {
        roomId: currentRoomRef.current,
        language: newLanguage
      });
      setSyncStatus(`Language set to ${newLanguage}`);
    }
  };

  /**
   * Action: Clear Editor Code
   */
  const handleClearCode = () => {
    if (socketRef.current && socketRef.current.connected && currentRoomRef.current) {
      socketRef.current.emit('clear-code', { roomId: currentRoomRef.current });
      setSyncStatus('Clearing editor...');
    }
  };

  /**
   * Action: Reset Code to starter template
   */
  const handleResetCode = () => {
    if (socketRef.current && socketRef.current.connected && currentRoomRef.current) {
      socketRef.current.emit('reset-code', { roomId: currentRoomRef.current });
      setSyncStatus('Resetting code...');
    }
  };

  /**
   * Action: Leave Room and return to Home
   */
  const handleLeaveRoom = () => {
    if (socketRef.current && currentRoomRef.current) {
      socketRef.current.emit('leave-room', { roomId: currentRoomRef.current });
    }
    setRoomId('');
    setCode('');
    setParticipants([]);
    setErrorMessage('');
    setCurrentView('home');
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        roomId={currentView === 'editor' ? roomId : null}
        isConnected={isConnected}
        onLeaveRoom={handleLeaveRoom}
        onOpenServerModal={() => setIsServerModalOpen(true)}
      />

      {/* Main View Router */}
      {currentView === 'home' ? (
        <main className="content-main">
          <Home
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            errorMessage={errorMessage}
            clearError={() => setErrorMessage('')}
            isConnected={isConnected}
            backendUrl={backendUrl}
            onOpenServerModal={() => setIsServerModalOpen(true)}
          />
        </main>
      ) : (
        <main className="editor-layout">
          <section className="editor-main-section">
            <Editor
              code={code}
              language={language}
              roomId={roomId}
              participantCount={participants.length}
              isConnected={isConnected}
              syncStatus={syncStatus}
              onCodeChange={handleCodeChange}
              onLanguageChange={handleLanguageChange}
              onClearCode={handleClearCode}
              onResetCode={handleResetCode}
            />
          </section>

          <aside className="editor-sidebar-section">
            <Participants
              participants={participants}
              currentSocketId={socketRef.current?.id}
              currentUser={currentUser}
            />
          </aside>
        </main>
      )}

      {/* Server Settings Modal */}
      <ServerModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        currentUrl={backendUrl}
        onUpdateUrl={handleUpdateBackendUrl}
        isConnected={isConnected}
      />
    </div>
  );
}
