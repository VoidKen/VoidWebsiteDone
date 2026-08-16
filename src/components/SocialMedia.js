import React from 'react';

const links = [
  {
    name: 'Discord',
    href: 'https://discord.com/users/1247845124529193022',
    icon: 'https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/discord.svg',
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/voidk.en?igsh=ZmJ1aGk0eWp0eGVm',
    icon: 'https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/instagram.svg',
  },
  {
    name: 'Twitch',
    href: 'https://www.twitch.tv/voidkaneki1',
    icon: 'https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/twitch.svg',
  },
];

function SocialMedia() {
  return (
    <section className="content-card" id="social-media">
      <h2>Connect with Me</h2>
      <ul className="social-links">
        {links.map((link) => (
          <li key={link.name}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              title={link.name}
            >
              <img src={link.icon} alt={link.name} width="28" />
              <span>{link.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SocialMedia;
