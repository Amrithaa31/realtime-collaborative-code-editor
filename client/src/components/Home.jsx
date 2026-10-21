import React, { useState } from 'react';

/**
 * Home Component
 * Landing page allowing users to Create a Room, Join an existing Room,
 * configure their backend server, and learn about the application features.
 */
export default function Home({
  onCreateRoom,
  onJoinRoom,
  errorMessage,
  clearError,
  isConnected,
  backendUrl,
  onOpenServerModal
}) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState('');

  // Handle Create Room
  const handleCreate = (e) => {
    e.preventDefault();
    if (clearError) clearError();
    setLocalError('');
    onCreateRoom(username.trim());
  };

  // Handle Join Room
  const handleJoin = (e) => {
    e.preventDefault();
    if (clearError) clearError();
    setLocalError('');

    if (!joinRoomId.trim()) {
      setLocalError('Please enter a valid Room ID to join.');
      return;
    }

    onJoinRoom(joinRoomId.trim(), username.trim());
  };

  const activeError = localError || errorMessage;

  return (
    <div className="home-container">
      {/* Hero Header */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="badge-dot"></span> Full Stack Web Development Project
        </div>
        <h1 className="hero-title">
          <span className="text-highlight">CodeTogether</span>
        </h1>
        <h2 className="hero-subtitle">Real-Time Collaborative Code Editor</h2>
        <p className="hero-description">
          A lightweight web application for developers and students to code together in real time.
          Create a room, share the ID with your team, and collaborate seamlessly with instant live updates.
        </p>

        {/* Server Connection Status Banner */}
        {!isConnected ? (
          <div className="connection-warning">
            <span>⚠️ <strong>Backend Server Disconnected:</strong> Cannot reach <code>{backendUrl || 'None'}</code></span>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={onOpenServerModal}
              style={{ marginLeft: '12px' }}
            >
              ⚙️ Server Settings
            </button>
          </div>
        ) : (
          <div 
            className="connection-badge-active" 
            onClick={onOpenServerModal} 
            title="Click to view or edit server connection settings"
            style={{ cursor: 'pointer' }}
          >
            <span className="status-indicator-dot" style={{ backgroundColor: 'var(--accent-green)', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }}></span>
            <span>Connected to backend: <code>{backendUrl}</code></span>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Change)</span>
          </div>
        )}

        {/* Error Alert Display */}
        {activeError && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <div className="alert-content">
              <strong>Error:</strong> {activeError}
            </div>
            <button 
              type="button" 
              className="alert-close" 
              onClick={() => { setLocalError(''); if (clearError) clearError(); }}
            >
              ✕
            </button>
          </div>
        )}
      </section>

      {/* Action Cards: Create Room & Join Room */}
      <section className="actions-section">
        <div className="action-cards-grid">
          {/* Card 1: Create Room */}
          <div className="action-card">
            <div className="card-header">
              <div className="card-icon create-icon">➕</div>
              <div>
                <h3>Create New Room</h3>
                <p>Start a new collaborative coding session instantly.</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="card-form">
              <div className="form-group">
                <label htmlFor="create-username">Your Name (Optional)</label>
                <input
                  id="create-username"
                  type="text"
                  placeholder="e.g. Alex (defaults to User 1)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  maxLength={30}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-block"
                disabled={!isConnected}
              >
                🚀 Create Room
              </button>
            </form>
          </div>

          {/* Card 2: Join Room */}
          <div className="action-card">
            <div className="card-header">
              <div className="card-icon join-icon">🔗</div>
              <div>
                <h3>Join Existing Room</h3>
                <p>Enter a shared Room ID to collaborate with peers.</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="card-form">
              <div className="form-group">
                <label htmlFor="join-room-id">Room ID <span className="required">*</span></label>
                <input
                  id="join-room-id"
                  type="text"
                  placeholder="e.g. room-abc123"
                  value={joinRoomId}
                  onChange={(e) => {
                    setJoinRoomId(e.target.value);
                    if (localError) setLocalError('');
                  }}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="join-username">Your Name (Optional)</label>
                <input
                  id="join-username"
                  type="text"
                  placeholder="e.g. Charlie (defaults to User 2)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  maxLength={30}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-secondary btn-block"
                disabled={!isConnected}
              >
                🚪 Join Room
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="features-section">
        <h3 className="section-title">Core Project Highlights</h3>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h4>Real-Time Synchronization</h4>
            <p>
              Every keystroke broadcasts via Socket.IO events to all connected room members with zero latency.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h4>Room-Based Collaboration</h4>
            <p>
              Sessions are isolated by Room IDs. What happens in Room A stays in Room A and won't affect Room B.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h4>Multiple Users Together</h4>
            <p>
              Collaborate live with multiple team members. The active participants panel updates dynamically.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎓</div>
            <h4>Beginner-Friendly & Clean</h4>
            <p>
              Built using core web development principles—React, Express, and Socket.IO—without unnecessary bloat.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
