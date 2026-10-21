import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const Home = ({ user, onLogout }) => {
  return (
    <div className="app-container">
      <Navbar user={user} onLogout={onLogout} />

      <main className="main-content">
        <div className="container">
          <section className="hero-section">
            <h1 className="hero-title">Real-Time Collaborative Code Editor</h1>
            <p className="hero-subtitle">
              A streamlined full-stack web application designed for developers and students to create
              shared coding rooms, collaborate simultaneously with real-time updates, and securely persist
              their code.
            </p>

            <div className="hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary">
                  Go to Dashboard &rarr;
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-primary">
                    Login to Your Account
                  </Link>
                  <Link to="/register" className="btn btn-secondary">
                    Register New Account
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="how-it-works-box">
            <h3>How Collaborative Coding Works</h3>
            <ol className="steps-list">
              <li>
                <strong>User Authentication:</strong> Securely register or log in using your student email. Passwords are salted and hashed using bcrypt, with JSON Web Tokens (JWT) protecting your sessions.
              </li>
              <li>
                <strong>Room Management:</strong> Create a unique coding room or join an existing room with its unique Room ID from your dashboard.
              </li>
              <li>
                <strong>Real-Time Synchronization:</strong> When multiple members join a room, Monaco Editor pairs with persistent Socket.IO WebSockets to broadcast changes instantaneously.
              </li>
              <li>
                <strong>Persistent Cloud Storage:</strong> Save your code and language settings to MongoDB. Restoring your session or refreshing the browser restores the latest version.
              </li>
            </ol>
          </section>

          <section className="features-grid">
            <div className="feature-card">
              <h4 className="feature-title">Multi-Language Monaco Editor</h4>
              <p className="feature-desc">
                Powered by the industry-standard Monaco Editor with full syntax highlighting for JavaScript, Python, Java, C++, HTML, CSS, and JSON.
              </p>
            </div>

            <div className="feature-card">
              <h4 className="feature-title">Real-Time Socket.IO Sync</h4>
              <p className="feature-desc">
                Bidirectional, low-latency WebSocket communication ensures all participants in the same room view code edits with minimal delay.
              </p>
            </div>

            <div className="feature-card">
              <h4 className="feature-title">Room Access Control</h4>
              <p className="feature-desc">
                Rooms are isolated and authenticated. Only authorized members can view, edit, or delete their shared workspace documents.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <p>
          University Full Stack Development Course Project &bull; Built with React, Express, Node.js, Socket.IO, and MongoDB
        </p>
      </footer>
    </div>
  );
};

export default Home;
