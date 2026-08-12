import React from 'react';

const features = ['Leveling System', 'VIP Shop', 'Moderation'];

const commands = [
  { cmd: '/help', desc: 'Show the help menu' },
  { cmd: '/rank', desc: 'Check your level & XP' },
  { cmd: '/shop', desc: 'Browse VIP perks' },
];

function DiscordBot() {
  return (
    <section className="content-card bot-card" id="discord-bot">
      <div className="bot-header">
        <div className="bot-avatar-wrap">
          <img
            src="/voidverse-logo.png"
            alt="VoidBot"
            className="bot-avatar"
          />
          <span className="status-dot" title="Online" />
        </div>
        <div className="bot-heading-text">
          <h2>VoidBot</h2>
          <p className="bot-tagline">The Discord bot behind New Legends</p>
        </div>
      </div>

      <p className="bot-description">
        Handles leveling, VIP perks, and moderation for the server — all in
        one place.
      </p>

      <ul className="feature-chips">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <div className="command-list">
        {commands.map((c) => (
          <div className="command-row" key={c.cmd}>
            <code>{c.cmd}</code>
            <span>{c.desc}</span>
          </div>
        ))}
      </div>

      <a
        className="cta-button invite-button"
        href="https://discord.com/oauth2/authorize?client_id=1348700164184998010&permissions=8&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fcallback&integration_type=0&scope=guilds+guilds.join+bot"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src="https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/discord.svg"
          alt=""
          className="inline-icon"
        />
        Invite VoidBot to your server
      </a>
    </section>
  );
}

export default DiscordBot;
