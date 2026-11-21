import React from 'react';
import { Toggle, NumberField, SelectField, TextField, ChannelSelect, RoleSelect, MultiPicker, TagInput } from './fields';

export const SECTION_META = [
  { key: 'antinuke', title: 'Anti-nuke', icon: '🛡️', blurb: 'Stops someone with permissions from wiping the server: too many deletions, bans or kicks inside a short window and they are punished.' },
  { key: 'automod', title: 'Automod', icon: '🤖', blurb: 'Spam, invite links, banned words and links, mention spam. Repeat offenders get a timeout.' },
  { key: 'antialt', title: 'Anti-alt', icon: '🕵️', blurb: 'Handles brand-new accounts when they join. Needs the bot\'s Server Members intent.' },
  { key: 'levels', title: 'Levels', icon: '⭐', blurb: 'XP for chatting, level-up announcements and the leaderboard.' },
  { key: 'tickets', title: 'Tickets', icon: '🎫', blurb: 'Support ticket roles, welcome message, category and transcripts.' },
  { key: 'logging', title: 'Logging & roles', icon: '📜', blurb: 'Where moderation and server events are logged, and the role new members get.' },
];

const LIMIT_LABELS = {
  channelDelete: 'Channels deleted', channelCreate: 'Channels created', roleDelete: 'Roles deleted', roleCreate: 'Roles created',
  ban: 'Members banned', kick: 'Members kicked', webhookCreate: 'Webhooks created', emojiDelete: 'Emojis deleted', botAdd: 'Bots added',
};

const isId = (s) => (/^\d{15,25}$/.test(s) ? '' : 'That is not a Discord user ID (17-19 digits).');

function AntiNuke({ draft, set, disabled }) {
  return (
    <>
      <Toggle label="Anti-nuke enabled" checked={draft.enabled} disabled={disabled} onChange={(v) => set(['enabled'], v)} />
      <div className="dash-grid">
        <SelectField label="Punishment" value={draft.punishment} disabled={disabled} onChange={(v) => set(['punishment'], v)}
          options={[{ value: 'ban', label: 'Ban them' }, { value: 'kick', label: 'Kick them' }, { value: 'strip', label: 'Only remove their dangerous roles' }]} />
        <NumberField label="Time window" suffix="seconds" min={3} max={120} value={draft.windowSeconds} disabled={disabled} onChange={(v) => set(['windowSeconds'], v)} />
      </div>
      <h3 className="dash-subhead">Allowed actions inside the window</h3>
      <p className="dash-hint">Doing more than this inside the window triggers the punishment. 0 turns that check off.</p>
      <div className="dash-grid">
        {Object.keys(LIMIT_LABELS).map((k) => (
          <NumberField key={k} label={LIMIT_LABELS[k]} hint="0 = off" min={0} max={50} value={draft.limits[k]} disabled={disabled} onChange={(v) => set(['limits', k], v)} />
        ))}
      </div>
      <Toggle label="Rebuild deleted channels" hint="Recreates channels removed during a nuke." checked={draft.restoreChannels} disabled={disabled} onChange={(v) => set(['restoreChannels'], v)} />
      <Toggle label="DM the server owner" hint="Tells the owner when someone is punished." checked={draft.dmOwner} disabled={disabled} onChange={(v) => set(['dmOwner'], v)} />
      <TagInput label="Trusted users (Discord user IDs)" hint="Anti-nuke ignores these people. The server owner and bot superusers are always trusted." values={draft.whitelist}
        validate={isId} placeholder="Paste a user ID, press Enter" maxItems={50} disabled={disabled} onChange={(v) => set(['whitelist'], v)} />
    </>
  );
}

function Automod({ draft, set, disabled, channels, roles }) {
  return (
    <>
      <Toggle label="Automod enabled" checked={draft.enabled} disabled={disabled} onChange={(v) => set(['enabled'], v)} />
      <Toggle label="Block Discord invite links" checked={draft.blockInvites} disabled={disabled} onChange={(v) => set(['blockInvites'], v)} />
      <NumberField label="Mention limit per message" hint="0 = off" min={0} max={50} value={draft.mentionLimit} disabled={disabled} onChange={(v) => set(['mentionLimit'], v)} />

      <h3 className="dash-subhead">Spam</h3>
      <Toggle label="Spam detection" checked={draft.spam.enabled} disabled={disabled} onChange={(v) => set(['spam', 'enabled'], v)} />
      <div className="dash-grid">
        <NumberField label="Messages" min={2} max={50} value={draft.spam.messages} disabled={disabled} onChange={(v) => set(['spam', 'messages'], v)} />
        <NumberField label="Within (seconds)" min={1} max={60} value={draft.spam.seconds} disabled={disabled} onChange={(v) => set(['spam', 'seconds'], v)} />
      </div>
      <Toggle label="Duplicate message detection" checked={draft.duplicates.enabled} disabled={disabled} onChange={(v) => set(['duplicates', 'enabled'], v)} />
      <div className="dash-grid">
        <NumberField label="Same message sent" suffix="times" min={2} max={20} value={draft.duplicates.count} disabled={disabled} onChange={(v) => set(['duplicates', 'count'], v)} />
        <NumberField label="Within (seconds)" min={5} max={300} value={draft.duplicates.seconds} disabled={disabled} onChange={(v) => set(['duplicates', 'seconds'], v)} />
      </div>
      <Toggle label="Excessive caps filter" checked={draft.caps.enabled} disabled={disabled} onChange={(v) => set(['caps', 'enabled'], v)} />
      <div className="dash-grid">
        <NumberField label="Only messages longer than" suffix="characters" min={5} max={200} value={draft.caps.minLength} disabled={disabled} onChange={(v) => set(['caps', 'minLength'], v)} />
        <NumberField label="Capital letters over" suffix="percent" min={30} max={100} value={draft.caps.percent} disabled={disabled} onChange={(v) => set(['caps', 'percent'], v)} />
      </div>

      <h3 className="dash-subhead">Punishment</h3>
      <div className="dash-grid">
        <NumberField label="Timeout after this many strikes" min={1} max={20} value={draft.strikes.timeoutAt} disabled={disabled} onChange={(v) => set(['strikes', 'timeoutAt'], v)} />
        <NumberField label="Strikes counted over" suffix="minutes" min={1} max={1440} value={draft.strikes.windowMinutes} disabled={disabled} onChange={(v) => set(['strikes', 'windowMinutes'], v)} />
        <NumberField label="Timeout length" suffix="minutes" min={1} max={40320} value={draft.strikes.timeoutMinutes} disabled={disabled} onChange={(v) => set(['strikes', 'timeoutMinutes'], v)} />
      </div>

      <h3 className="dash-subhead">Word and link lists</h3>
      <TagInput label="Banned words" hint="Whole words only, any capitalisation. Press Enter or comma to add." values={draft.bannedWords} maxItems={200} disabled={disabled} onChange={(v) => set(['bannedWords'], v)} />
      <TagInput label="Banned links" hint="Any message containing this text is removed, e.g. bit.ly/" values={draft.bannedLinks} maxItems={100} disabled={disabled} onChange={(v) => set(['bannedLinks'], v)} />

      <h3 className="dash-subhead">Exceptions</h3>
      <MultiPicker label="Ignored channels" values={draft.ignoredChannels} items={channels} prefix="#" disabled={disabled} onChange={(v) => set(['ignoredChannels'], v)} />
      <MultiPicker label="Ignored roles" values={draft.ignoredRoles} items={roles} prefix="@" disabled={disabled} onChange={(v) => set(['ignoredRoles'], v)} />
    </>
  );
}

function AntiAlt({ draft, set, disabled, channels }) {
  return (
    <>
      <Toggle label="Anti-alt enabled" checked={draft.enabled} disabled={disabled} onChange={(v) => set(['enabled'], v)} />
      <div className="dash-grid">
        <NumberField label="Minimum account age" suffix="days" min={1} max={365} value={draft.thresholdDays} disabled={disabled} onChange={(v) => set(['thresholdDays'], v)} />
        <SelectField label="When an account is too new" value={draft.action} disabled={disabled} onChange={(v) => set(['action'], v)}
          options={[{ value: 'kick', label: 'Kick them' }, { value: 'alert', label: 'Only post a warning' }]} />
      </div>
      <ChannelSelect label="Alert channel" hint="Leave empty to use the mod-log channel." value={draft.logChannelId} channels={channels} disabled={disabled} onChange={(v) => set(['logChannelId'], v)} />
    </>
  );
}

function Levels({ draft, set, disabled, channels }) {
  return (
    <>
      <Toggle label="Levels enabled" checked={draft.enabled} disabled={disabled} onChange={(v) => set(['enabled'], v)} />
      <div className="dash-grid">
        <NumberField label="XP per message" min={1} max={100} value={draft.xpPerMessage} disabled={disabled} onChange={(v) => set(['xpPerMessage'], v)} />
        <NumberField label="Cooldown between XP gains" suffix="seconds" min={0} max={3600} value={draft.cooldownSeconds} disabled={disabled} onChange={(v) => set(['cooldownSeconds'], v)} />
      </div>
      <Toggle label="Announce level-ups" checked={draft.announce} disabled={disabled} onChange={(v) => set(['announce'], v)} />
      <ChannelSelect label="Announcement channel" hint="Leave empty to announce in the channel where they levelled up." value={draft.announceChannelId} channels={channels} disabled={disabled} onChange={(v) => set(['announceChannelId'], v)} />
    </>
  );
}

function Tickets({ draft, set, disabled, channels, roles }) {
  return (
    <>
      <MultiPicker label="Support roles" hint="These roles can see and answer every ticket." values={draft.supportRoleIds} items={roles} prefix="@" disabled={disabled} onChange={(v) => set(['supportRoleIds'], v)} />
      <MultiPicker label="Roles to ping when a ticket opens" values={draft.notifyRoleIds} items={roles} prefix="@" disabled={disabled} onChange={(v) => set(['notifyRoleIds'], v)} />
      <div className="dash-grid">
        <TextField label="Category name" hint="Created automatically if it doesn't exist." value={draft.categoryName} maxLength={100} disabled={disabled} onChange={(v) => set(['categoryName'], v)} />
        <TextField label="Channel name prefix" hint="Lowercase letters, numbers, - and _ only." value={draft.channelPrefix} maxLength={20} disabled={disabled} onChange={(v) => set(['channelPrefix'], v.toLowerCase())} />
      </div>
      <ChannelSelect label="Transcript channel" hint="Closed tickets are saved here as a text file. Empty = no transcripts." value={draft.logChannelId} channels={channels} disabled={disabled} onChange={(v) => set(['logChannelId'], v)} />
      <TextField label="Welcome message" multiline hint="Placeholders: {user} {user_name} {reason} {channel}" value={draft.message} maxLength={1500} disabled={disabled} onChange={(v) => set(['message'], v)} />
    </>
  );
}

function Logging({ draft, set, disabled, channels, roles }) {
  return (
    <>
      <ChannelSelect label="Mod-log channel" hint="Warnings, mutes, bans, anti-nuke and automod actions are posted here." value={draft.modlogChannelId} channels={channels} disabled={disabled} onChange={(v) => set(['modlogChannelId'], v)} />
      <ChannelSelect label="Server log channel" hint="Joins, leaves, edited and deleted messages, role and channel changes." value={draft.serverlogChannelId} channels={channels} disabled={disabled} onChange={(v) => set(['serverlogChannelId'], v)} />
      <RoleSelect label="Join role" hint="Given to every new member. Needs the bot's Server Members intent, and the bot's role must be above it." value={draft.joinRoleId} roles={roles} disabled={disabled} onChange={(v) => set(['joinRoleId'], v)} />
    </>
  );
}

export const FORMS = { antinuke: AntiNuke, automod: Automod, antialt: AntiAlt, levels: Levels, tickets: Tickets, logging: Logging };
