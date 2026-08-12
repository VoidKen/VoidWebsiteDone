import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import { useSession, loginUrl } from '../context/SessionContext';
import '../styles/account.css';

function AccountPage() {
  const { user, loading: sessionLoading } = useSession();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetch('/api/my-products')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProducts(data.products || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, sessionLoading]);

  const handleDownload = async (productId) => {
    setDownloadingId(productId);
    try {
      window.location.href = `/api/download?product=${encodeURIComponent(productId)}`;
    } finally {
      setTimeout(() => setDownloadingId(null), 1500);
    }
  };

  return (
    <div className="account-page">
      <Navbar />
      <div className="account-content">
        <h1>My Purchases</h1>

        {sessionLoading && <p className="account-muted">Loading…</p>}

        {!sessionLoading && !user && (
          <div className="account-empty">
            <p>Log in with Discord to see what you own.</p>
            <a className="cta-button" href={loginUrl('/account')}>
              Log in with Discord
            </a>
          </div>
        )}

        {!sessionLoading && user && loading && <p className="account-muted">Loading your products…</p>}

        {!sessionLoading && user && error && (
          <p className="account-error">{error}</p>
        )}

        {!sessionLoading && user && !loading && !error && products.length === 0 && (
          <div className="account-empty">
            <p>You haven't bought anything yet.</p>
          </div>
        )}

        {!sessionLoading && user && products.length > 0 && (
          <ul className="owned-list">
            {products.map((p) => (
              <li key={p.productId} className="owned-item">
                <div>
                  <span className="owned-name">{p.name}</span>
                  <span className="owned-meta">
                    {p.source === 'admin' ? 'Granted by admin' : 'Purchased'} ·{' '}
                    {new Date(p.grantedAt).toLocaleDateString()}
                  </span>
                </div>
                {p.hasFile ? (
                  <button
                    className="buy-button"
                    disabled={downloadingId === p.productId}
                    onClick={() => handleDownload(p.productId)}
                  >
                    {downloadingId === p.productId ? 'Starting…' : 'Download'}
                  </button>
                ) : (
                  <span className="owned-meta">No file yet — open a ticket on Discord</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AccountPage;
