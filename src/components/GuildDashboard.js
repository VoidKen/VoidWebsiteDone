import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import SectionEditor from '../dashboard/SectionEditor';
import ActivityTab from '../dashboard/ActivityTab';
import WheelsTab from '../dashboard/WheelsTab';
import CommandsTab from '../dashboard/CommandsTab';
import { SECTION_META } from '../dashboard/sections';
import { api, dashLoginUrl } from '../dashboard/api';
import { guildIcon } from './DashboardPage';
import '../styles/dashboard.css';

function GuildDashboard() {
  const { guildId } = useParams();
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [tab, setTab] = useState('antinuke');

  useEffect(() => {
    setBundle(null); setError(null);
    api({ r: 'guild', g: guildId })
      .then(setBundle)
      .catch((err) => { setError(err.message); setNeedsLogin(!!err.needsLogin); });
  }, [guildId]);

  const guild = bundle && bundle.guild;

  return (
    <div className="dash-page">
      <Navbar />
      <div className="dash-wrap">
        <Link to="/dashboard" className="dash-back">← All servers</Link>

        {error && (
          <div className="dash-error" role="alert">
            {error}
            {needsLogin && <> <a href={dashLoginUrl(`/dashboard/${guildId}`)}>Log in again</a></>}
          </div>
        )}
        {!bundle && !error && <p className="dash-hint">Loading…</p>}

        {bundle && (
          <>
            <div className="dash-guild-head">
              {guildIcon(guild) ? <img src={guildIcon(guild)} alt="" className="dash-guild-icon" /> : <span className="dash-guild-icon fallback">{guild.name.slice(0, 1).toUpperCase()}</span>}
              <div>
                <h1 className="dash-title">{guild.name}</h1>
                <p className="dash-sub">{bundle.level === 'admin' ? 'You are an Administrator here' : 'You have Manage Server here, so some sections are read-only'}</p>
              </div>
            </div>

            <div className="dash-layout">
              <nav className="dash-nav" aria-label="Settings sections">
                {SECTION_META.map((m) => (
                  <button key={m.key} type="button" className={`dash-nav-item${tab === m.key ? ' active' : ''}`} onClick={() => setTab(m.key)}>
                    <span aria-hidden="true">{m.icon}</span> {m.title}
                    {!bundle.sections[m.key].editable && <span className="dash-nav-lock" title="Read-only for you">🔒</span>}
                  </button>
                ))}
                <button type="button" className={`dash-nav-item${tab === 'wheels' ? ' active' : ''}`} onClick={() => setTab('wheels')}>
                  <span aria-hidden="true">🎡</span> Wheels
                </button>
                <button type="button" className={`dash-nav-item${tab === 'commands' ? ' active' : ''}`} onClick={() => setTab('commands')}>
                  <span aria-hidden="true">💬</span> Custom commands
                  {bundle.level !== 'admin' && <span className="dash-nav-lock" title="Read-only for you">🔒</span>}
                </button>
                <button type="button" className={`dash-nav-item${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>
                  <span aria-hidden="true">📋</span> Activity
                </button>
              </nav>

              <div className="dash-main">
                {tab === 'activity' && <ActivityTab guildId={guildId} />}
                {tab === 'wheels' && <WheelsTab key={guildId} guildId={guildId} guild={guild} />}
                {tab === 'commands' && <CommandsTab key={guildId} guildId={guildId} />}
                {!['activity', 'wheels', 'commands'].includes(tab) && <SectionEditor key={`${guildId}-${tab}`} guildId={guildId} name={tab} section={bundle.sections[tab]} guild={guild} />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GuildDashboard;
