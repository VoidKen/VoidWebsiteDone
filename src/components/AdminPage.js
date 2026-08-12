import React, { useEffect, useState } from 'react';
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

  const loadGrants = () => {
    setGrantsLoading(true);
    fetch('/api/admin/grants')
      .then((res) => res.json())
      .then((data) => setGrants(data.grants || []))
      .catch(() => {})
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
      <div className="account-content">
        <h1>Admin</h1>

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

        <h2>Recent grants</h2>
        {grantsLoading ? (
          <p className="account-muted">Loading…</p>
        ) : grants.length === 0 ? (
          <p className="account-muted">Nothing yet.</p>
        ) : (
          <table className="grants-table">
            <thead>
              <tr>
                <th>Discord User ID</th>
                <th>Product</th>
                <th>Source</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>{g.discordUserId}</td>
                  <td>{g.productName}</td>
                  <td>{g.source}</td>
                  <td>{new Date(g.grantedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
