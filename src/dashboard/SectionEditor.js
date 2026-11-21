import React, { useState } from 'react';
import { api, setIn } from './api';
import { FORMS, SECTION_META } from './sections';

/** One settings form: holds the unsaved draft, saves it, and shows exactly what the server said went wrong. */
export default function SectionEditor({ guildId, name, section, guild, onSaved }) {
  const meta = SECTION_META.find((m) => m.key === name);
  const Form = FORMS[name];
  const [saved, setSaved] = useState(section.value);
  const [draft, setDraft] = useState(section.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [version, setVersion] = useState(0); // remounts the form so half-typed invalid numbers don't linger after Discard

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const disabled = !section.editable || saving;

  const set = (path, value) => { setDraft((d) => setIn(d, path, value)); setJustSaved(false); setError(''); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await api({ r: 'settings', g: guildId }, { method: 'POST', body: { section: name, values: draft } });
      setSaved(res.value); setDraft(res.value); setJustSaved(true); setVersion((v) => v + 1);
      if (onSaved) onSaved(name, res.value);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dash-card">
      <header className="dash-card-head">
        <div>
          <h2>{meta.icon} {meta.title}</h2>
          <p className="dash-hint">{meta.blurb}</p>
        </div>
      </header>

      {!section.editable && (
        <div className="dash-lock">
          🔒 {section.level === 'admin' ? 'Only people with the Administrator permission can change this.' : "You can't change this."} You can look, but not edit.
        </div>
      )}

      <div className="dash-form">
        <Form key={version} draft={draft} set={set} disabled={disabled} channels={guild.channels} roles={guild.roles} />
      </div>

      {error && <div className="dash-error" role="alert">{error}</div>}

      {section.editable && (
        <footer className="dash-actions">
          <button type="button" className="dash-btn primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
          <button type="button" className="dash-btn" disabled={!dirty || saving} onClick={() => { setDraft(saved); setError(''); setVersion((v) => v + 1); }}>Discard</button>
          {justSaved && !dirty && <span className="dash-saved">✓ Saved. The bot picks it up within about 30 seconds.</span>}
          {dirty && !saving && <span className="dash-hint">Unsaved changes</span>}
        </footer>
      )}
    </section>
  );
}
