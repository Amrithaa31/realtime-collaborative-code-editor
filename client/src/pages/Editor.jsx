import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MonacoEditor from '@monaco-editor/react';
import api from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';

const SUPPORTED_LANGUAGES = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'Java', value: 'java' },
  { label: 'C++', value: 'cpp' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' }
];

const FONT_SIZES = [12, 14, 16, 18, 20];

const Editor = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // Room & Document State
  const [room, setRoom] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [fontSize, setFontSize] = useState(14);
  const [participants, setParticipants] = useState([]);

  // Status & Feedback State
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected'
  const [saveStatus, setSaveStatus] = useState('All changes saved'); // 'All changes saved' | 'Unsaved changes' | 'Saving...'
  const [lastSaved, setLastSaved] = useState(null);
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Refs to control real-time updates and eliminate loop hazards
  const socketRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const editorRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const codeRef = useRef('');
  const languageRef = useRef('javascript');

  // Keep refs synchronized with state
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Handle Monaco editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  // Initial Data Fetch & Socket Connection
  useEffect(() => {
    let isMounted = true;

    const setupSession = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. Fetch Room Details to verify membership
        const roomRes = await api.rooms.getRoom(roomId);
        if (!isMounted) return;
        setRoom(roomRes.room);

        // 2. Fetch Latest Saved Document from MongoDB
        const docRes = await api.documents.getDocument(roomId);
        if (!isMounted) return;
        const initialCode = docRes.document?.content || '';
        const initialLang = docRes.document?.language || 'javascript';

        setCode(initialCode);
        setLanguage(initialLang);
        if (docRes.document?.updatedAt) {
          setLastSaved(new Date(docRes.document.updatedAt).toLocaleTimeString());
        }

        // 3. Connect Socket.IO
        const socket = initSocket();
        socketRef.current = socket;

        socket.on('connect', () => {
          if (!isMounted) return;
          setConnectionStatus('connected');

          // Join the room via socket
          socket.emit('join-room', { roomId }, (ack) => {
            if (ack?.error) {
              setError(ack.error);
            }
          });
        });

        socket.on('connect_error', (err) => {
          if (!isMounted) return;
          console.error('Socket connection error:', err.message);
          setConnectionStatus('disconnected');
        });

        socket.on('disconnect', () => {
          if (!isMounted) return;
          setConnectionStatus('disconnected');
        });

        // Room state initialization from server
        socket.on('room-init', (data) => {
          if (!isMounted) return;
          isRemoteUpdateRef.current = true;
          if (data.content !== undefined) setCode(data.content);
          if (data.language) setLanguage(data.language);
          if (Array.isArray(data.participants)) setParticipants(data.participants);
          isRemoteUpdateRef.current = false;
        });

        // Remote code update broadcast
        socket.on('code-update', (data) => {
          if (!isMounted) return;
          if (data.code !== undefined && data.code !== codeRef.current) {
            isRemoteUpdateRef.current = true;
            setCode(data.code);
            // Brief timeout ensures React change callback finishes without re-emitting
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 50);
          }
        });

        // Remote language update broadcast
        socket.on('language-update', (data) => {
          if (!isMounted) return;
          if (data.language) {
            setLanguage(data.language);
          }
        });

        // Participant joined notification
        socket.on('user-joined', (data) => {
          if (!isMounted) return;
          if (Array.isArray(data.participants)) {
            setParticipants(data.participants);
          }
        });

        // Participant left notification
        socket.on('user-left', (data) => {
          if (!isMounted) return;
          if (Array.isArray(data.participants)) {
            setParticipants(data.participants);
          }
        });
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to initialize coding room.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setupSession();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.emit('leave-room', { roomId });
      }
      disconnectSocket();
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [roomId]);

  // Handle local code edits in Monaco Editor
  const handleCodeChange = (newVal) => {
    const updatedValue = newVal || '';
    setCode(updatedValue);

    // If change was caused by remote socket update, don't re-emit!
    if (isRemoteUpdateRef.current) {
      return;
    }

    setSaveStatus('Unsaved changes');

    // Emit live changes to peers in room
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('code-change', {
        roomId,
        code: updatedValue
      });
    }

    // Debounced auto-save to MongoDB (saves 3 seconds after typing ceases)
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      persistCodeToDb(updatedValue, languageRef.current, true);
    }, 3000);
  };

  // Handle language switch
  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setSaveStatus('Unsaved changes');

    // Broadcast language update to room peers
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('language-change', {
        roomId,
        language: newLang
      });
    }

    // Persist language change to DB
    persistCodeToDb(codeRef.current, newLang, false);
  };

  // Persist code & language to database
  const persistCodeToDb = async (contentToSave, langToSave, isAuto = false) => {
    try {
      setSaveStatus('Saving...');
      const res = await api.documents.saveDocument(roomId, {
        content: contentToSave,
        language: langToSave
      });

      const timeStr = new Date(res.document.updatedAt || Date.now()).toLocaleTimeString();
      setLastSaved(timeStr);
      setSaveStatus(`Saved at ${timeStr}`);
    } catch (err) {
      console.error('Error saving code:', err.message);
      setSaveStatus('Save failed');
    }
  };

  // Manual Save button click
  const handleManualSave = () => {
    persistCodeToDb(code, language, false);
  };

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Copy Room ID
  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedRoomId(true);
      setTimeout(() => setCopiedRoomId(false), 2000);
    } catch (err) {
      console.error('Failed to copy room id:', err);
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  if (loading) {
    return (
      <div className="editor-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#a1a1aa', fontSize: '1.1rem' }}>Loading collaborative coding workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-layout" style={{ justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '480px', backgroundColor: '#27272a', padding: '28px', borderRadius: '6px', textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Access Restricted</h2>
          <p style={{ color: '#d4d4d8', marginBottom: '20px' }}>{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-layout">
      {/* 1. Header */}
      <header className="editor-header">
        <div className="editor-header-left">
          <Link to="/dashboard" className="editor-brand" title="Back to Dashboard">
            &larr; Dashboard
          </Link>

          <div className="editor-room-info">
            <span className="editor-room-name">{room?.name || 'Coding Room'}</span>
            <span
              onClick={handleCopyRoomId}
              className="editor-room-id-pill"
              title="Click to copy Room ID to share with collaborators"
            >
              {copiedRoomId ? '✓ Copied ID!' : `ID: ${roomId}`}
            </span>
          </div>
        </div>

        <div className="editor-header-right">
          {/* Socket Connection Status */}
          <div className="status-indicator" title={`Socket: ${connectionStatus}`}>
            <span className={`status-dot ${connectionStatus}`}></span>
            <span style={{ textTransform: 'capitalize', color: '#a1a1aa' }}>
              {connectionStatus}
            </span>
          </div>

          {/* Document Save Status */}
          <span className="save-status-text" title={lastSaved ? `Last saved at ${lastSaved}` : ''}>
            {saveStatus}
          </span>

          {/* Leave Room Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-secondary btn-sm"
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* 2. Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          {/* Language Selector */}
          <label htmlFor="lang-select" style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
            Language:
          </label>
          <select
            id="lang-select"
            className="editor-select"
            value={language}
            onChange={handleLanguageChange}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          {/* Font Size Selector */}
          <label htmlFor="font-select" style={{ fontSize: '0.85rem', color: '#a1a1aa', marginLeft: '8px' }}>
            Font Size:
          </label>
          <select
            id="font-select"
            className="editor-select"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-group">
          {/* Copy Code Button */}
          <button
            onClick={handleCopyCode}
            className="btn btn-secondary btn-sm"
            title="Copy current code to clipboard"
          >
            {copiedCode ? '✓ Copied!' : 'Copy Code'}
          </button>

          {/* Save Code Button */}
          <button
            onClick={handleManualSave}
            className="btn btn-primary btn-sm"
            title="Explicitly save document to MongoDB"
          >
            Save Code
          </button>
        </div>
      </div>

      {/* 3. Main Workspace Area */}
      <div className="editor-body">
        {/* Monaco Code Editor */}
        <div className="editor-canvas-container">
          <MonacoEditor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize: fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              fontFamily: "'Courier New', Courier, monospace",
              formatOnPaste: true,
              formatOnType: true
            }}
          />
        </div>

        {/* Connected Participants Panel */}
        <aside className="participants-sidebar">
          <div className="participants-header">
            <span>Active Participants</span>
            <span className="badge badge-owner" style={{ fontSize: '0.75rem' }}>
              {participants.length}
            </span>
          </div>

          <ul className="participants-list">
            {participants.length === 0 ? (
              <li style={{ color: '#71717a', fontSize: '0.8rem', padding: '8px' }}>
                Connecting to room...
              </li>
            ) : (
              participants.map((p) => {
                const isCurrent = p.userId === currentUser.id;
                const initials = p.name ? p.name.substring(0, 2).toUpperCase() : 'U';

                return (
                  <li key={p.socketId || p.userId} className="participant-item">
                    <span className="participant-avatar">{initials}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name || 'Anonymous User'}
                    </span>
                    {isCurrent && (
                      <span className="participant-current-tag">(You)</span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default Editor;
