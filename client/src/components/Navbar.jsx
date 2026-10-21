import React, { useState } from 'react';

/**
 * Navbar Component
 * Displays brand logo, current room ID, copy room button, connection status,
 * server settings trigger, and a button to leave the current room.
 */
export default function Navbar({ roomId, isConnected, onLeaveRoom, onOpenServerModal }) {
  const [copied, setCopied] = useState(false);

  // Copy Room ID to clipboard with browser fallback
  const handleCopyId = () => {
    if (!roomId) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(roomId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopyText(roomId);
      });
    } else {
      fallbackCopyText(roomId);
    }
  };

  const fallbackCopyText = (text) => {
    try {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert(`Room ID: ${text} (Please copy manually)`);
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="navbar-brand">
          <span className="brand-icon">&lt;/&gt;</span>
          <span className="brand-name">CodeTogether</span>
        </div>

        {roomId && (
          <div className="room-id-badge">
            <span className="badge-label">Room:</span>
            <span className="badge-value">{roomId}</span>
          </div>
        )}
      </div>

      <div className="navbar-right">
        {/* Connection status indicator */}
        <div 
          className={`connection-status ${isConnected ? 'status-connected' : 'status-disconnected'}`}
          onClick={onOpenServerModal}
          title="Click to view or edit server connection settings"
          style={{ cursor: 'pointer' }}
        >
          <span className="status-indicator-dot"></span>
          <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        {/* Server Config Button */}
        <button
          type="button"
          onClick={onOpenServerModal}
          className="btn btn-sm btn-outline"
          title="Configure Backend WebSocket Server URL"
        >
          ⚙️ Server
        </button>

        {roomId && (
          <>
            <button 
              type="button" 
              onClick={handleCopyId} 
              className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline'}`}
              title="Copy Room ID to share with friends"
            >
              {copied ? '✓ Copied!' : '📋 Copy Room ID'}
            </button>

            <button 
              type="button" 
              onClick={onLeaveRoom} 
              className="btn btn-sm btn-danger"
              title="Leave this collaboration room"
            >
              🚪 Leave Room
            </button>
          </>
        )}
      </div>
    </header>
  );
}
