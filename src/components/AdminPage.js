import React, { useEffect, useMemo, useState } from 'react';
import Navbar from './Navbar';
import { useSession, loginUrl } from '../context/SessionContext';
import products from '../data/products';
import '../styles/admin.css';

function AdminPage() {
  const { user, loading: sessionLoading } = useSession();
  const [discordUserId, setDiscordUserId] = useState('');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [grants, setGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [grantsError, setGrantsError] = useState(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [revokingId, setRevokingId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const loadGrants = () => {
    setGrantsLoading(true);
    setGrantsError(null);
    fetch('/api/admin/grants')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setGrants(data.grants || []);
      })
      .catch((err) => setGrantsError(err.message))
      .finally(() => setGrantsLoading(false));
  };

  useEffect(() => {
    if (user?.isAdmin) loadGrants();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordUserId: discordUserId.trim(), productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to grant product');
      setMessage({ type: 'success', text: 'Granted!' });
      setDiscordUserId('');
      loadGrants();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (grantId) => {
    setRevokingId(grantId);
    try {
      const res = await fetch('/api/admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke');
      setGrants((prev) => prev.filter((g) => g.id !== grantId));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRevokingId(null);
      setConfirmingId(null);
    }
  };

  const stats = useMemo(() => {
    const uniqueUsers = new Set(grants.map((g) => g.discordUserId)).size;
    const stripeCount = grants.filter((g) => g.source === 'stripe').length;
    const revenue = grants
      .filter((g) => g.source === 'stripe')
      .reduce((sum, g) => {
        const product = products.find((p) => p.id === g.productId);
        return sum + (product ? product.price : 0);
      }, 0);
    return { total: grants.length, uniqueUsers, stripeCount, revenue };
  }, [grants]);

  const filteredGrants = useMemo(() => {
    return grants.filter((g) => {
      if (sourceFilter !== 'all' && g.source !== sourceFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        g.discordUserId.toLowerCase().includes(q) ||
        g.productName.toLowerCase().includes(q)
      );
    });
  }, [grants, search, sourceFilter]);

  const copyId = (id) => {
    navigator.clipboard?.writeText(id);
  };

  if (sessionLoading) {
    return (
      <div className="admin-page">
        <Navbar />
        <p className="account-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-page">
        <Navbar />
        <div className="account-content">
          <p>Log in with Discord to continue.</p>
          <a className="cta-button" href={loginUrl('/admin')}>
            Log in with Discord
          </a>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="admin-page">
        <Navbar />
        <div className="account-content">
          <p>This page is only for the site admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Navbar />
      <div className="account-content admin-content">
        <h1>Admin</h1>

        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total grants</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.uniqueUsers}</span>
            <span className="stat-label">Unique buyers</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">{stats.stripeCount}</span>
            <span className="stat-label">Stripe purchases</span>
          </div>
          <div className="stat-tile">
            <span className="stat-value">£{stats.revenue.toFixed(2)}</span>
            <span className="stat-label">Stripe revenue</span>
          </div>
        </div>

        <div className="admin-panel">
          <h2>Grant a product</h2>
          <form className="grant-form" onSubmit={handleSubmit}>
            <label>
              Discord User ID
              <input
                type="text"
                value={discordUserId}
                onChange={(e) => setDiscordUserId(e.target.value)}
                placeholder="e.g. 1247845124529193022"
                required
              />
            </label>
            <label>
              Product
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="cta-button" type="submit" disabled={submitting}>
              {submitting ? 'Granting…' : 'Grant product'}
            </button>
            {message && (
              <span className={`grant-message ${message.type}`}>{message.text}</span>
            )}
          </form>
        </div>

        <div className="admin-panel">
          <div className="grants-header">
            <h2>Grants</h2>
            <div className="grants-controls">
              <input
                type="text"
                className="grants-search"
                placeholder="Search by Discord ID or product…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="grants-filter"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All sources</option>
                <option value="stripe">Stripe only</option>
                <option value="admin">Admin-granted only</option>
              </select>
            </div>
          </div>

          {grantsLoading ? (
            <p className="account-muted">Loading…</p>
          ) : grantsError ? (
            <p className="account-error-detail">{grantsError}</p>
          ) : filteredGrants.length === 0 ? (
            <p className="account-muted">
              {grants.length === 0 ? 'Nothing yet.' : 'No grants match your search.'}
            </p>
          ) : (
            <table className="grants-table">
              <thead>
                <tr>
                  <th>Discord User ID</th>
                  <th>Product</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredGrants.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <button
                        className="id-copy"
                        title="Copy ID"
                        onClick={() => copyId(g.discordUserId)}
                      >
                        {g.discordUserId}
                      </button>
                    </td>
                    <td>{g.productName}</td>
                    <td>
                      <span className={`source-badge ${g.source}`}>{g.source}</span>
                    </td>
                    <td>{new Date(g.grantedAt).toLocaleString()}</td>
                    <td className="revoke-cell">
                      {confirmingId === g.id ? (
                        <span className="revoke-confirm">
                          Sure?{' '}
                          <button
                            className="revoke-confirm-yes"
                            disabled={revokingId === g.id}
                            onClick={() => handleRevoke(g.id)}
                          >
                            Yes
                          </button>{' '}
                          <button
                            className="revoke-confirm-no"
                            onClick={() => setConfirmingId(null)}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          className="revoke-btn"
                          onClick={() => setConfirmingId(g.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
