import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Field, SelectField, RoleSelect } from './fields';

const MAX_WHEELS = 25;
const MAX_NAMES = 200;
const EMPTY = { name: '', type: 'names', namesText: '', roleId: null, isNew: true };
const splitNames = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);
const label = (n) => (n === 'default' ? 'default' : n);

function Summary({ wheel }) {
  if (wheel.type === 'all') return <span className="dash-hint">Everyone in the server (not bots)</span>;
  if (wheel.type === 'role') return <span className="dash-hint">Members of the role <strong>@{wheel.roleName || wheel.roleId}</strong></span>;
  const shown = wheel.names.slice(0, 12);
  return (
    <div className="dash-chips">
      {shown.map((n) => <span key={n} className="dash-chip static">{n}</span>)}
      {wheel.names.length > shown.length && <span className="dash-hint">+{wheel.names.length - shown.length} more</span>}
    </div>
  );
}

export default function WheelsTab({ guildId, guild }) {
  const [wheels, setWheels] = useState(null);
  const [editable, setEditable] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api({ r: 'wheels', g: guildId });
      setWheels(data.wheels); setEditable(data.editable);
    } catch (err) { setError(err.message); }
  }, [guildId]);
  useEffect(() => { load(); }, [load]);

  const edit = (w) => { setNotice(''); setError(''); setForm({ name: w.name, type: w.type, namesText: (w.names || []).join('\n'), roleId: w.roleId || null, isNew: false }); };

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const body = { action: 'save', name: form.name, type: form.type };
    if (form.type === 'names') body.names = splitNames(form.namesText);
    if (form.type === 'role') body.roleId = form.roleId;
    try {
      const res = await api({ r: 'wheel', g: guildId }, { method: 'POST', body });
      setForm(null); setNotice(`Saved wheel "${label(res.name)}". Use /wheel saved:${res.name} in Discord to spin it.`);
      await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const remove = async (w) => {
    if (!window.confirm(`Delete the wheel "${label(w.name)}"? This can't be undone.`)) return;
    setError(''); setNotice('');
    try {
      await api({ r: 'wheel', g: guildId }, { method: 'POST', body: { action: 'delete', name: w.name } });
      if (form && form.name === w.name) setForm(null);
      setNotice(`Deleted "${label(w.name)}".`);
      await load();
    } catch (err) { setError(err.message); }
  };

  const nameCount = form && form.type === 'names' ? splitNames(form.namesText).length : 0;

  return (
    <section className="dash-card">
      <header className="dash-card-head">
        <div>
          <h2>🎡 Wheels</h2>
          <p className="dash-hint">Saved wheels you can spin in Discord with <code>/wheel</code>. Spinning happens in Discord; this page is for managing them.</p>
        </div>
        {editable && !form && wheels && (
          <button type="button" className="dash-btn primary" disabled={wheels.length >= MAX_WHEELS} onClick={() => { setNotice(''); setError(''); setForm({ ...EMPTY }); }}>+ New wheel</button>
        )}
      </header>

      {notice && <div className="dash-saved dash-notice">✓ {notice}</div>}
      {error && <div className="dash-error" role="alert">{error}</div>}

      {form && (
        <div className="dash-editor">
          <h3 className="dash-subhead first">{form.isNew ? 'New wheel' : `Editing "${label(form.name)}"`}</h3>
          <div className="dash-grid">
            <Field label="Name" hint="Leave empty for the default wheel. Saving an existing name replaces it.">
              <input className="dash-input" value={form.name} maxLength={50} disabled={!form.isNew} placeholder="default" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <SelectField label="Picks from" value={form.type} onChange={(v) => setForm({ ...form, type: v })}
              options={[{ value: 'names', label: 'A list of names' }, { value: 'role', label: 'Members of a role' }, { value: 'all', label: 'All server members' }]} />
          </div>
          {form.type === 'names' && (
            <Field label="Names" wide hint={`One per line. ${nameCount}/${MAX_NAMES}`}>
              <textarea className="dash-input" rows={8} value={form.namesText} onChange={(e) => setForm({ ...form, namesText: e.target.value })} />
            </Field>
          )}
          {form.type === 'role' && <RoleSelect label="Role" hint="Anyone with this role can be picked." value={form.roleId} roles={guild.roles} onChange={(v) => setForm({ ...form, roleId: v })} />}
          {form.type !== 'names' && <p className="dash-hint">Members are looked up by the bot when the wheel is spun, so the list isn't shown here.</p>}
          <div className="dash-actions">
            <button type="button" className="dash-btn primary" disabled={saving || (form.type === 'names' && nameCount === 0) || (form.type === 'role' && !form.roleId)} onClick={save}>{saving ? 'Saving…' : 'Save wheel'}</button>
            <button type="button" className="dash-btn" disabled={saving} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {wheels === null && !error && <p className="dash-hint">Loading…</p>}
      {wheels && wheels.length === 0 && !form && <p className="dash-hint">No saved wheels yet.{editable ? ' Click "New wheel" to make one.' : ''}</p>}

      {wheels && wheels.length > 0 && (
        <ul className="dash-list">
          {wheels.map((w) => (
            <li key={w.name} className="dash-list-item">
              <div className="dash-list-main">
                <div className="dash-list-title">
                  <strong>{label(w.name)}</strong>
                  <span className="dash-tag">{w.type === 'names' ? `${w.names.length} names` : w.type === 'role' ? 'role' : 'all members'}</span>
                </div>
                <Summary wheel={w} />
              </div>
              {editable && (
                <div className="dash-list-actions">
                  <button type="button" className="dash-btn" onClick={() => edit(w)}>Edit</button>
                  <button type="button" className="dash-btn danger" onClick={() => remove(w)}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {wheels && <p className="dash-hint">{wheels.length}/{MAX_WHEELS} wheels used</p>}
    </section>
  );
}
