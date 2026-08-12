import React from 'react';
import Navbar from './Navbar';
import Shop from './Shop';
import '../styles/shoppage.css';

function ShopPage() {
  const bgStyle = {
    backgroundImage:
      'linear-gradient(rgba(10, 10, 12, 0.85), rgba(10, 10, 12, 0.9)), url(' +
      process.env.PUBLIC_URL +
      '/shop-bg.png)',
  };

  return (
    <div className="shop-page" style={bgStyle}>
      <Navbar />
      <div className="shop-page-intro">
        <h1>The Shop</h1>
        <p>Digital goods and custom work — paid securely by card.</p>
      </div>
      <Shop />
    </div>
  );
}

export default ShopPage;
