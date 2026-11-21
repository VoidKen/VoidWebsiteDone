import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import { useSession } from '../context/SessionContext';
import { api, dashLoginUrl } from '../dashboard/api';
import '../styles/dashboard.css';

export const guildIcon = (g) => (g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'png'}?size=96` : null);

function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const [guilds, setGuilds] = useState(null);
  const [error, setError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (sessionLoading || !user) return;
    api({ r: 'guilds' })
      .then((d) => setGuilds(d.guilds))
      .catch((err) => { setError(err.message); setNeedsLogin(!!err.needsLogin); });
  }, [sessionLoading, user]);

  return (
    <div className="dash-page">
      <Navbar />
      <div className="dash-wrap">
        <h1 className="dash-title">Bot Dashboard</h1>
        <p className="dash-sub">Manage VoidBot in the servers where you have Manage Server or Administrator.</p>

        {sessionLoading && <p className="dash-hint">Loading…</p>}

        {!sessionLoading && !user && (
          <div className="dash-empty">
            <p>Log in with Discord to see your servers.</p>
            <a className="dash-btn primary" href={dashLoginUrl('/dashboard')}>Log in with Discord</a>
          </div>
        )}

        {error && (
          <div className="dash-error" role="alert">
            {error}
            {needsLogin && <> <a href={dashLoginUrl('/dashboard')}>Log in again</a></>}
          </div>
        )}

        {user && !error && guilds === null && <p className="dash-hint">Loading your servers…</p>}

        {guilds && guilds.length === 0 && (
          <div className="dash-empty">
            <p>No servers found. VoidBot has to be in the server, and you need the Manage Server or Administrator permission there.</p>
            <a className="dash-btn" href={dashLoginUrl('/dashboard')}>Refresh my servers</a>
          </div>
        )}

        {guilds && guilds.length > 0 && (
          <>
            <div className="dash-guilds">
              {guilds.map((g) => (
                <Link key={g.id} to={`/dashboard/${g.id}`} className="dash-guild">
                  {guildIcon(g) ? <img src={guildIcon(g)} alt="" className="dash-guild-icon" /> : <span className="dash-guild-icon fallback">{g.name.slice(0, 1).toUpperCase()}</span>}
                  <span className="dash-guild-name">{g.name}</span>
                  <span className="dash-guild-meta">{g.memberCount ? `${g.memberCount.toLocaleString()} members · ` : ''}{g.level === 'admin' ? 'Administrator' : 'Manage Server'}</span>
                </Link>
              ))}
            </div>
            <p className="dash-hint">Don't see a server? <a href={dashLoginUrl('/dashboard')}>Refresh my servers</a></p>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
