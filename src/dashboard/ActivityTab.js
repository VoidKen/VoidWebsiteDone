import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api';

const FEEDS = [
  { key: 'events', label: 'Mod log' },
  { key: 'warnings', label: 'Warnings' },
  { key: 'tickets', label: 'Tickets' },
];

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const Id = ({ id }) => (id ? <code className="dash-id" title="Discord ID">{id}</code> : <span className="dash-hint">—</span>);

function describe(item) {
  const d = item.details || {};
  if (item.kind === 'dashboard_settings') return `Changed ${d.section} settings on the website${d.changed?.length ? ` (${d.changed.join(', ')})` : ''}`;
  return item.reason || '';
}

export default function ActivityTab({ guildId }) {
  const [feed, setFeed] = useState('events');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (before) => {
    setLoading(true); setError('');
    try {
      const query = { r: 'activity', g: guildId, type: feed };
      if (before) query.before = String(before);
      const data = await api(query);
      setItems((prev) => (before ? [...prev, ...data.items] : data.items));
      setMore(data.items.length >= 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [guildId, feed]);

  useEffect(() => { setItems([]); load(null); }, [load]);

  return (
    <section className="dash-card">
      <header className="dash-card-head">
        <div>
          <h2>📋 Activity</h2>
          <p className="dash-hint">Read-only. Shows Discord IDs because the website can't look names up.</p>
        </div>
      </header>

      <div className="dash-tabs-inline" role="tablist">
        {FEEDS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={feed === f.key} className={`dash-pill${feed === f.key ? ' active' : ''}`} onClick={() => setFeed(f.key)}>{f.label}</button>
        ))}
      </div>

      {error && <div className="dash-error" role="alert">{error}</div>}
      {!error && !loading && items.length === 0 && <p className="dash-hint">Nothing here yet.</p>}

      {items.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            {feed === 'events' && (
              <>
                <thead><tr><th>When</th><th>Type</th><th>By</th><th>Target</th><th>Details</th></tr></thead>
                <tbody>{items.map((i) => (
                  <tr key={i.id}><td>{when(i.at)}</td><td><span className="dash-tag">{i.kind}</span></td><td><Id id={i.actorId} /></td><td><Id id={i.targetId} /></td><td>{describe(i)}</td></tr>
                ))}</tbody>
              </>
            )}
            {feed === 'warnings' && (
              <>
                <thead><tr><th>When</th><th>Member</th><th>Moderator</th><th>Reason</th></tr></thead>
                <tbody>{items.map((i) => (
                  <tr key={i.id}><td>{when(i.at)}</td><td><Id id={i.userId} /></td><td><Id id={i.moderatorId} /></td><td>{i.reason}</td></tr>
                ))}</tbody>
              </>
            )}
            {feed === 'tickets' && (
              <>
                <thead><tr><th>Opened</th><th>Owner</th><th>Status</th><th>Claimed by</th><th>Priority</th><th>Reason</th></tr></thead>
                <tbody>{items.map((i) => (
                  <tr key={i.id}><td>{when(i.at)}</td><td><Id id={i.ownerId} /></td><td><span className={`dash-tag ${i.open ? 'open' : ''}`}>{i.open ? 'Open' : `Closed ${when(i.closedAt)}`}</span></td><td><Id id={i.claimedBy} /></td><td>{i.priority || '—'}</td><td>{i.reason || ''}</td></tr>
                ))}</tbody>
              </>
            )}
          </table>
        </div>
      )}

      {loading && <p className="dash-hint">Loading…</p>}
      {more && !loading && <button type="button" className="dash-btn" onClick={() => load(items[items.length - 1].id)}>Load more</button>}
    </section>
  );
}
