import React from 'react';

/**
 * Participants Component
 * Displays the list of currently active collaborators in the room.
 */
export default function Participants({ participants = [], currentSocketId, currentUser }) {
  return (
    <aside className="participants-panel">
      <div className="participants-header">
        <div className="participants-title">
          <span className="icon">👥</span>
          <h3>Participants</h3>
        </div>
        <span className="participant-count-badge">
          {participants.length} {participants.length === 1 ? 'user' : 'users'}
        </span>
      </div>

      <div className="participants-list">
        {participants.length === 0 ? (
          <p className="no-participants">Waiting for collaborators...</p>
        ) : (
          participants.map((user, index) => {
            const isMe = user.id === currentSocketId || user.username === currentUser;
            return (
              <div 
                key={user.id || index} 
                className={`participant-item ${isMe ? 'participant-me' : ''}`}
              >
                <div className="participant-avatar">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="participant-info">
                  <span className="participant-name">
                    {user.username || `User ${index + 1}`}
                  </span>
                  {isMe && <span className="you-pill">You</span>}
                </div>
                <span className="user-online-dot"></span>
              </div>
            );
          })
        )}
      </div>

      <div className="participants-footer">
        <p className="help-text">
          💡 Share your <strong>Room ID</strong> with classmates or teammates to code together live.
        </p>
      </div>
    </aside>
  );
}
