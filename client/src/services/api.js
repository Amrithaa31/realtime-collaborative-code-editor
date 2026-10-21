const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to make fetch requests with standard headers & auth token
const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const api = {
  // Authentication
  auth: {
    register: (userData) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      }),
    login: (credentials) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),
    getMe: () => request('/auth/me')
  },

  // Rooms
  rooms: {
    createRoom: (roomData) =>
      request('/rooms', {
        method: 'POST',
        body: JSON.stringify(roomData)
      }),
    getRooms: () => request('/rooms'),
    getRoom: (roomId) => request(`/rooms/${roomId}`),
    joinRoom: (roomId) =>
      request(`/rooms/${roomId}/join`, {
        method: 'POST'
      }),
    leaveRoom: (roomId) =>
      request(`/rooms/${roomId}/leave`, {
        method: 'POST'
      }),
    deleteRoom: (roomId) =>
      request(`/rooms/${roomId}`, {
        method: 'DELETE'
      })
  },

  // Documents
  documents: {
    getDocument: (roomId) => request(`/documents/${roomId}`),
    saveDocument: (roomId, docData) =>
      request(`/documents/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify(docData)
      })
  },

  // Health
  health: {
    check: () => request('/health')
  }
};

export default api;
