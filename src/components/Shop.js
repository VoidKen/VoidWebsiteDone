import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import products from '../data/products';
import ProductCard from './ProductCard';
import '../styles/shop.css';

function Shop() {
  const [searchParams] = useSearchParams();
  // Tracks stock locally after a purchase so a sold-out item disables immediately.
  const [soldOut, setSoldOut] = useState({});

  const justPurchasedId = searchParams.get('success') === '1'
    ? searchParams.get('product')
    : null;
  const wasCanceled = searchParams.get('canceled') === '1';

  return (
    <section id="shop" className="shop-section">
      <h2 className="shop-title">Items</h2>

      {justPurchasedId && (
        <div className="shop-banner success">
          Payment successful! Head to{' '}
          <a href="/account">My Purchases</a> to download it.
        </div>
      )}
      {wasCanceled && (
        <div className="shop-banner canceled">
          Checkout was canceled — no payment was taken.
        </div>
      )}

      <div className="shop-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isSoldOut={!!soldOut[product.id] || product.id === justPurchasedId}
            onPurchased={() =>
              setSoldOut((prev) => ({ ...prev, [product.id]: true }))
            }
          />
        ))}
      </div>
    </section>
  );
}

export default Shop;
