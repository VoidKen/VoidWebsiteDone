import React, { useEffect, useState } from 'react';

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`dash-field${wide ? ' wide' : ''}`}>
      <span className="dash-label">{label}</span>
      {children}
      {hint && <span className="dash-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`dash-toggle${disabled ? ' disabled' : ''}`}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="dash-switch" aria-hidden="true" />
      <span className="dash-toggle-text">
        <span className="dash-label">{label}</span>
        {hint && <span className="dash-hint">{hint}</span>}
      </span>
    </label>
  );
}

export function NumberField({ label, hint, value, onChange, min, max, suffix, disabled }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (t.trim() !== '' && Number(t) === value ? t : String(value)));
  }, [value]);
  const n = Number(text);
  const valid = text.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
  return (
    <Field label={label} hint={hint || `${min} to ${max}${suffix ? ` ${suffix}` : ''}`}>
      <input
        className={`dash-input${valid ? '' : ' invalid'}`}
        type="number"
        inputMode="numeric"
        value={text}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          const next = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isInteger(next)) onChange(next);
        }}
      />
    </Field>
  );
}

export function TextField({ label, hint, value, onChange, maxLength, multiline, disabled }) {
  const props = { className: 'dash-input', value, maxLength, disabled, onChange: (e) => onChange(e.target.value) };
  return <Field label={label} hint={hint} wide={multiline}>{multiline ? <textarea rows={4} {...props} /> : <input type="text" {...props} />}</Field>;
}

export function SelectField({ label, hint, value, options, onChange, disabled }) {
  return (
    <Field label={label} hint={hint}>
      <select className="dash-input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

// ── Channels and roles. The bot publishes the lists, so names are shown instead of raw IDs. ──

function pickerOptions(items, value, prefix) {
  const known = items.some((i) => i.id === value);
  return [
    { value: '', label: '— none —' },
    ...(value && !known ? [{ value, label: `Unknown (${value})` }] : []),
    ...items.map((i) => ({ value: i.id, label: `${prefix}${i.name}` })),
  ];
}

export function ChannelSelect({ label, hint, value, onChange, channels, disabled }) {
  return <SelectField label={label} hint={hint} value={value || ''} disabled={disabled} options={pickerOptions(channels, value, '#')} onChange={(v) => onChange(v || null)} />;
}

export function RoleSelect({ label, hint, value, onChange, roles, disabled }) {
  return <SelectField label={label} hint={hint} value={value || ''} disabled={disabled} options={pickerOptions(roles, value, '@')} onChange={(v) => onChange(v || null)} />;
}

export function MultiPicker({ label, hint, values, onChange, items, prefix, disabled }) {
  const name = (id) => { const f = items.find((i) => i.id === id); return f ? `${prefix}${f.name}` : `Unknown (${id})`; };
  const remaining = items.filter((i) => !values.includes(i.id));
  return (
    <Field label={label} hint={hint} wide>
      <div className="dash-chips">
        {values.length === 0 && <span className="dash-hint">None</span>}
        {values.map((id) => (
          <span key={id} className="dash-chip">
            {name(id)}
            {!disabled && <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => onChange(values.filter((v) => v !== id))}>×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <select className="dash-input" value="" onChange={(e) => e.target.value && onChange([...values, e.target.value])}>
          <option value="">Add…</option>
          {remaining.map((i) => <option key={i.id} value={i.id}>{prefix}{i.name}</option>)}
        </select>
      )}
    </Field>
  );
}

/** Free-text list (banned words, links, user IDs). Enter or comma adds; `validate` can reject an entry. */
export function TagInput({ label, hint, values, onChange, placeholder, validate, maxItems, disabled }) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');

  const add = () => {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const part of parts) {
      const bad = validate && validate(part);
      if (bad) { setProblem(bad); return; }
      if (!next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    if (maxItems && next.length > maxItems) { setProblem(`At most ${maxItems} entries.`); return; }
    setProblem(''); setText(''); onChange(next);
  };

  return (
    <Field label={label} hint={problem || hint} wide>
      <div className="dash-chips">
        {values.length === 0 && <span className="dash-hint">None</span>}
        {values.map((v) => (
          <span key={v} className="dash-chip">
            {v}
            {!disabled && <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="dash-row">
          <input
            className={`dash-input${problem ? ' invalid' : ''}`}
            value={text}
            placeholder={placeholder}
            onChange={(e) => { setText(e.target.value); setProblem(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          />
          <button type="button" className="dash-btn" onClick={add}>Add</button>
        </div>
      )}
    </Field>
  );
}
