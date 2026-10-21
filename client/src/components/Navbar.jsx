import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to={user ? "/dashboard" : "/"} className="navbar-brand">
        <span>💻</span>
        <span>Collaborative Editor</span>
      </Link>

      <div className="navbar-links">
        {user ? (
          <>
            <span className="navbar-user-text">
              Signed in as <span className="navbar-user-name">{user.name}</span>
            </span>
            <Link to="/dashboard" className="btn btn-secondary btn-sm">
              Dashboard
            </Link>
            <button
              onClick={handleLogoutClick}
              className="btn btn-outline-danger btn-sm"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-secondary btn-sm">
              Login
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
