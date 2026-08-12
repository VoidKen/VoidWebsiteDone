import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import Navbar from './components/Navbar';
import AboutMe from './components/AboutMe';
import DiscordBot from './components/DiscordBot';
import SocialMedia from './components/SocialMedia';
import EmailMe from './components/EmailMe';
import ShopPage from './components/ShopPage';
import AccountPage from './components/AccountPage';
import AdminPage from './components/AdminPage';

function Home() {
  const [activeTab, setActiveTab] = useState('about');

  return (
    <div className="App">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <header className="hero">
        <img src="/voidverse-logo.png" alt="VoidVerse" className="hero-logo" />
        <h1>Welcome to Void's Corner</h1>
        <p className="hero-subtitle">
          Minecraft servers, Discord bots, and whatever I'm building next.
        </p>
      </header>

      <main>
        {activeTab === 'about' && <AboutMe />}
        {activeTab === 'bot' && <DiscordBot />}
        {activeTab === 'social' && <SocialMedia />}
        {activeTab === 'email' && <EmailMe />}
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Void</span>
      </footer>
    </div>
  );
}

function App() {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
