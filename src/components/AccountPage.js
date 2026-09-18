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
        <div className="account-header">
          <h1>My Purchases</h1>
          {user && !loading && !error && (
            <span className="account-count">
              {products.length} item{products.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {sessionLoading && <p className="account-muted">Loading…</p>}

        {!sessionLoading && !user && (
          <div className="account-empty">
            <div className="empty-icon">🔒</div>
            <p>Log in with Discord to see what you own.</p>
            <a className="cta-button" href={loginUrl('/account')}>
              Log in with Discord
            </a>
          </div>
        )}

        {!sessionLoading && user && loading && (
          <p className="account-muted">Loading your products…</p>
        )}

        {!sessionLoading && user && error && (
          <div className="account-error-box">
            <span className="empty-icon">⚠️</span>
            <div>
              <p className="account-error-title">Couldn't load your purchases</p>
              <p className="account-error-detail">{error}</p>
            </div>
          </div>
        )}

        {!sessionLoading && user && !loading && !error && products.length === 0 && (
          <div className="account-empty">
            <div className="empty-icon">🛒</div>
            <p>You haven't bought anything yet.</p>
            <a className="cta-button secondary" href="/shop">
              Visit the shop
            </a>
          </div>
        )}

        {!sessionLoading && user && !loading && !error && products.length > 0 && (
          <div className="owned-grid">
            {products.map((p) => (
              <div key={p.productId} className="owned-card">
                <div className="owned-card-top">
                  <span className="owned-name">{p.name}</span>
                  <span className={`source-tag ${p.source}`}>
                    {p.source === 'admin' ? 'Granted' : 'Purchased'}
                  </span>
                </div>
                <span className="owned-date">
                  {new Date(p.grantedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>

                <div className="owned-card-footer">
                  {p.hasFile ? (
                    <button
                      className="buy-button"
                      disabled={downloadingId === p.productId}
                      onClick={() => handleDownload(p.productId)}
                    >
                      {downloadingId === p.productId ? 'Starting…' : '⬇ Download'}
                    </button>
                  ) : (
                    <span className="no-file-note">
                      No file yet — open a ticket on Discord
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountPage;
