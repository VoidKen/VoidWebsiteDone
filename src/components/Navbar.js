import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession, loginUrl } from '../context/SessionContext';

const homeTabs = [
  { key: 'about', label: 'About' },
  { key: 'bot', label: 'Discord Bot' },
  { key: 'social', label: 'Social' },
  { key: 'email', label: 'Contact' },
];

function Navbar({ activeTab, onTabChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const onHome = location.pathname === '/';
  const { user, loading } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const avatarUrl = user
    ? user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png'
    : null;

  return (
    <nav className="navbar">
      <div
        className="navbar-brand"
        onClick={() => navigate('/')}
        role="button"
        tabIndex={0}
      >
        <img src="/voidverse-logo.png" alt="VoidVerse" className="navbar-logo" />
        <span className="navbar-title">Void</span>
      </div>

      <div className="navbar-links">
        {onHome &&
          homeTabs.map((tab) => (
            <button
              key={tab.key}
              className={`navbar-link${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => onTabChange && onTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}

        {onHome ? (
          <button className="navbar-shop-btn" onClick={() => navigate('/shop')}>
            Shop
          </button>
        ) : (
          <button className="navbar-link" onClick={() => navigate('/')}>
            ← Home
          </button>
        )}

        {!loading && !user && (
          <a className="navbar-login-btn" href={loginUrl(location.pathname)}>
            <img
              src="https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/discord.svg"
              alt=""
              className="navbar-login-icon"
            />
            Log in
          </a>
        )}

        {!loading && user && (
          <div className="navbar-user" ref={menuRef} onClick={() => setMenuOpen((v) => !v)}>
            <img src={avatarUrl} alt={user.username} className="navbar-avatar" />
            <span className="navbar-username">{user.username}</span>

            {menuOpen && (
              <div className="navbar-menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setMenuOpen(false); navigate('/account'); }}>
                  My Purchases
                </button>
                {user.isAdmin && (
                  <button onClick={() => { setMenuOpen(false); navigate('/admin'); }}>
                    Admin
                  </button>
                )}
                <a href="/api/auth/logout">Log out</a>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
