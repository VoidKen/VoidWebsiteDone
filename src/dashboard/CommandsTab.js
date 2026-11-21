import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Field } from './fields';

const MAX_COMMANDS = 100;
const MAX_RESPONSE = 1800;
const NAME_OK = /^[a-z0-9_-]{1,32}$/;

export default function CommandsTab({ guildId }) {
  const [commands, setCommands] = useState(null);
  const [editable, setEditable] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api({ r: 'commands', g: guildId });
      setCommands(data.commands); setEditable(data.editable);
    } catch (err) { setError(err.message); }
  }, [guildId]);
  useEffect(() => { load(); }, [load]);

  const cleanName = form ? form.name.trim().toLowerCase().replace(/^[!/]/, '') : '';
  const nameValid = NAME_OK.test(cleanName);

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await api({ r: 'command', g: guildId }, { method: 'POST', body: { action: 'save', name: cleanName, response: form.response } });
      setForm(null); setNotice(`Saved !${res.name}. The bot starts using it within about 30 seconds.`);
      await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete the command !${c.name}? This can't be undone.`)) return;
    setError(''); setNotice('');
    try {
      await api({ r: 'command', g: guildId }, { method: 'POST', body: { action: 'delete', name: c.name } });
      if (form && cleanName === c.name) setForm(null);
      setNotice(`Deleted !${c.name}.`);
      await load();
    } catch (err) { setError(err.message); }
  };

  return (
    <section className="dash-card">
      <header className="dash-card-head">
        <div>
          <h2>💬 Custom commands</h2>
          <p className="dash-hint">Members type <code>!name</code> (or <code>/name</code> as plain text) in chat and the bot replies. Replies never ping anyone.</p>
        </div>
        {editable && !form && commands && (
          <button type="button" className="dash-btn primary" disabled={commands.length >= MAX_COMMANDS} onClick={() => { setNotice(''); setError(''); setForm({ name: '', response: '', isNew: true }); }}>+ New command</button>
        )}
      </header>

      {commands && !editable && <div className="dash-lock">🔒 Only people with the Administrator permission can add, edit or delete custom commands. You can look, but not edit.</div>}
      {notice && <div className="dash-saved dash-notice">✓ {notice}</div>}
      {error && <div className="dash-error" role="alert">{error}</div>}

      {form && (
        <div className="dash-editor">
          <h3 className="dash-subhead first">{form.isNew ? 'New command' : `Editing !${form.name}`}</h3>
          <Field label="Name" hint={form.name && !nameValid ? 'Letters, numbers, - and _ only (1 to 32 characters).' : 'Saving an existing name replaces its reply.'}>
            <div className="dash-row">
              <span className="dash-prefix">!</span>
              <input className={`dash-input${form.name && !nameValid ? ' invalid' : ''}`} value={form.name} maxLength={33} disabled={!form.isNew} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </Field>
          <Field label="Reply" wide hint={`${form.response.length}/${MAX_RESPONSE}`}>
            <textarea className="dash-input" rows={5} maxLength={MAX_RESPONSE} value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} />
          </Field>
          <div className="dash-actions">
            <button type="button" className="dash-btn primary" disabled={saving || !nameValid || !form.response.trim()} onClick={save}>{saving ? 'Saving…' : 'Save command'}</button>
            <button type="button" className="dash-btn" disabled={saving} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {commands === null && !error && <p className="dash-hint">Loading…</p>}
      {commands && commands.length === 0 && !form && <p className="dash-hint">No custom commands yet.{editable ? ' Click "New command" to add one.' : ''}</p>}

      {commands && commands.length > 0 && (
        <ul className="dash-list">
          {commands.map((c) => (
            <li key={c.name} className="dash-list-item">
              <div className="dash-list-main">
                <div className="dash-list-title"><strong>!{c.name}</strong>{c.createdBy && <code className="dash-id" title="Created by (Discord ID)">{c.createdBy}</code>}</div>
                <div className="dash-reply">{c.response.length > 220 ? `${c.response.slice(0, 217)}…` : c.response}</div>
              </div>
              {editable && (
                <div className="dash-list-actions">
                  <button type="button" className="dash-btn" onClick={() => { setNotice(''); setError(''); setForm({ name: c.name, response: c.response, isNew: false }); }}>Edit</button>
                  <button type="button" className="dash-btn danger" onClick={() => remove(c)}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {commands && <p className="dash-hint">{commands.length}/{MAX_COMMANDS} commands used</p>}
    </section>
  );
}
