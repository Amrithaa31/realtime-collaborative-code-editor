import React, { useState } from 'react';

/**
 * ServerModal Component
 * Allows users to inspect and configure the Backend WebSocket server URL.
 * Particularly useful when deployed to Vercel so users can connect to either
 * a cloud-hosted backend (e.g. Render, Railway) or their local/tunneled server.
 */
export default function ServerModal({
  isOpen,
  onClose,
  currentUrl,
  onUpdateUrl,
  isConnected
}) {
  const [inputUrl, setInputUrl] = useState(currentUrl || '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      onUpdateUrl(inputUrl.trim());
      onClose();
    }
  };

  const setPreset = (url) => {
    setInputUrl(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">⚙️</span>
            <h3>Backend Server Configuration</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Socket.IO requires a persistent server to manage collaborative rooms.
            When viewing on Vercel, connect this frontend to your active backend URL.
          </p>

          <div className="current-server-status">
            <span>Status:</span>
            <strong className={isConnected ? 'text-success' : 'text-danger'}>
              {isConnected ? '✓ Connected' : '✕ Disconnected'}
            </strong>
          </div>

          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-group">
              <label htmlFor="backend-url-input">Backend Server URL:</label>
              <input
                id="backend-url-input"
                type="text"
                placeholder="https://your-backend.onrender.com or http://localhost:5000"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="preset-buttons">
              <span className="preset-label">Quick Presets:</span>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setPreset('http://localhost:5000')}
              >
                Localhost (Port 5000)
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save & Connect
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
