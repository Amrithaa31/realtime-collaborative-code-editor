import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../services/api';

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create room form state
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLang, setNewRoomLang] = useState('javascript');
  const [creating, setCreating] = useState(false);

  // Join room form state
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joining, setJoining] = useState(false);

  // Load rooms on mount
  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.rooms.getRooms();
      setRooms(data.rooms || []);
    } catch (err) {
      setError(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      setError('Please provide a name for the new room.');
      return;
    }

    try {
      setCreating(true);
      setError('');
      setSuccess('');
      const res = await api.rooms.createRoom({
        name: newRoomName.trim(),
        language: newRoomLang
      });

      setSuccess(`Room "${res.room.name}" created successfully!`);
      setNewRoomName('');
      // Navigate directly into the newly created room
      navigate(`/editor/${res.room.roomId}`);
    } catch (err) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    const cleanId = joinRoomId.trim();
    if (!cleanId) {
      setError('Please enter a valid Room ID to join.');
      return;
    }

    try {
      setJoining(true);
      setError('');
      setSuccess('');
      const res = await api.rooms.joinRoom(cleanId);
      setSuccess(`Joined "${res.room.name}" successfully!`);
      setJoinRoomId('');
      navigate(`/editor/${res.room.roomId}`);
    } catch (err) {
      setError(err.message || 'Could not join room. Verify the Room ID is correct.');
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete room "${roomName}"? All code will be lost.`
    );
    if (!confirmed) return;

    try {
      setError('');
      setSuccess('');
      await api.rooms.deleteRoom(roomId);
      setSuccess(`Room "${roomName}" deleted.`);
      setRooms(rooms.filter((r) => r.roomId !== roomId));
    } catch (err) {
      setError(err.message || 'Failed to delete room.');
    }
  };

  const handleLeaveRoom = async (roomId, roomName) => {
    const confirmed = window.confirm(`Are you sure you want to leave "${roomName}"?`);
    if (!confirmed) return;

    try {
      setError('');
      setSuccess('');
      await api.rooms.leaveRoom(roomId);
      setSuccess(`Left room "${roomName}".`);
      setRooms(rooms.filter((r) => r.roomId !== roomId));
    } catch (err) {
      setError(err.message || 'Failed to leave room.');
    }
  };

  const currentUserId = user?.id || JSON.parse(localStorage.getItem('user') || '{}').id;

  return (
    <div className="app-container">
      <Navbar user={user} onLogout={onLogout} />

      <main className="main-content">
        <div className="container">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Dashboard</h1>
              <p className="text-muted">
                Welcome back, <strong>{user?.name || 'Developer'}</strong>! Manage your coding rooms below.
              </p>
            </div>
            <button onClick={fetchRooms} className="btn btn-secondary btn-sm" disabled={loading}>
              Refresh Rooms
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Quick Actions: Create & Join */}
          <div className="dashboard-actions-grid">
            <div className="action-card">
              <h3>Create a New Room</h3>
              <form onSubmit={handleCreateRoom}>
                <div className="form-group">
                  <label className="form-label" htmlFor="roomName">
                    Room Name
                  </label>
                  <input
                    id="roomName"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Data Structures Project"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="roomLang">
                    Initial Language
                  </label>
                  <select
                    id="roomLang"
                    className="form-control"
                    value={newRoomLang}
                    onChange={(e) => setNewRoomLang(e.target.value)}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="json">JSON</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : '+ Create Room'}
                </button>
              </form>
            </div>

            <div className="action-card">
              <h3>Join Existing Room</h3>
              <p className="form-text-hint" style={{ marginBottom: '12px' }}>
                Enter the unique Room ID shared by your teammate or peer.
              </p>
              <form onSubmit={handleJoinRoom}>
                <div className="form-group">
                  <label className="form-label" htmlFor="joinId">
                    Room ID
                  </label>
                  <input
                    id="joinId"
                    type="text"
                    className="form-control mono"
                    placeholder="e.g. room-9f2b-4a1e"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-secondary" disabled={joining}>
                  {joining ? 'Joining...' : 'Join Room &rarr;'}
                </button>
              </form>
            </div>
          </div>

          {/* Rooms Table */}
          <h2 className="rooms-section-title">Your Coding Rooms</h2>

          {loading ? (
            <div className="empty-state">Loading your rooms from server...</div>
          ) : rooms.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: '1.05rem', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
                No rooms found
              </p>
              <p>You haven't created or joined any collaborative rooms yet.</p>
              <p style={{ marginTop: '8px' }}>
                Create your first room above or paste a shared Room ID to get started!
              </p>
            </div>
          ) : (
            <div className="rooms-table-container">
              <table className="rooms-table">
                <thead>
                  <tr>
                    <th>Room Name</th>
                    <th>Room ID</th>
                    <th>Role</th>
                    <th>Owner</th>
                    <th>Last Active</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => {
                    const isOwner =
                      room.owner?._id === currentUserId ||
                      room.owner === currentUserId;

                    return (
                      <tr key={room._id || room.roomId}>
                        <td>
                          <strong>{room.name}</strong>
                        </td>
                        <td>
                          <span className="mono" style={{ color: '#2563eb' }}>
                            {room.roomId}
                          </span>
                        </td>
                        <td>
                          {isOwner ? (
                            <span className="badge badge-owner">Owner</span>
                          ) : (
                            <span className="badge badge-member">Member</span>
                          )}
                        </td>
                        <td>{room.owner?.name || 'Owner'}</td>
                        <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                          {room.updatedAt
                            ? new Date(room.updatedAt).toLocaleDateString() +
                              ' ' +
                              new Date(room.updatedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Recently'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => navigate(`/editor/${room.roomId}`)}
                            className="btn btn-primary btn-sm"
                            style={{ marginRight: '8px' }}
                          >
                            Open Room
                          </button>

                          {isOwner ? (
                            <button
                              onClick={() => handleDeleteRoom(room.roomId, room.name)}
                              className="btn btn-outline-danger btn-sm"
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLeaveRoom(room.roomId, room.name)}
                              className="btn btn-secondary btn-sm"
                            >
                              Leave
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>University Full Stack Development Course Project</p>
      </footer>
    </div>
  );
};

export default Dashboard;
