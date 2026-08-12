import React, { useState } from 'react';
import { useSession, loginUrl } from '../context/SessionContext';

function ProductCard({ product, isSoldOut, onPurchased }) {
  const { user, loading: sessionLoading } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const outOfStock = isSoldOut || product.stock === 0;

  const handleBuy = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to start checkout');
      }
      onPurchased();
      window.location.href = data.url; // redirect to Stripe Checkout
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="product-card">
      <div
        className="product-image"
        style={{ backgroundImage: `url(${product.image})` }}
      />
      <div className="product-body">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-description">{product.description}</p>
      </div>
      <div className="product-footer">
        <span className="product-stock">
          {outOfStock
            ? 'Sold out'
            : product.stock === null
            ? 'In stock'
            : `${product.stock}/${product.stock} Available`}
        </span>

        {!sessionLoading && !user ? (
          <a className="buy-button" href={loginUrl('/shop')}>
            Log in to buy
          </a>
        ) : (
          <button
            className="buy-button"
            disabled={outOfStock || loading || sessionLoading}
            onClick={handleBuy}
          >
            {outOfStock
              ? 'Sold out'
              : loading
              ? 'Redirecting…'
              : `Buy for £${product.price.toFixed(2)}`}
          </button>
        )}

        {error && <span className="product-status error">{error}</span>}
      </div>
    </div>
  );
}

export default ProductCard;
