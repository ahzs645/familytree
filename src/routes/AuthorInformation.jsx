import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuthorInfo, saveAuthorInfo } from '../lib/authorInfo.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { readField } from '../lib/schema.js';

export default function AuthorInformation() {
  const [values, setValues] = useState(null);
  const [media, setMedia] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getLocalDatabase();
      const [info, pictures] = await Promise.all([
        getAuthorInfo(),
        db.query('MediaPicture', { limit: 100000 }),
      ]);
      if (!cancelled) {
        setValues(info);
        setMedia(pictures.records);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((key, value) => {
    setValues((current) => ({ ...(current || {}), [key]: value }));
  }, []);

  const save = useCallback(async () => {
    const next = await saveAuthorInfo(values);
    setValues(next);
    setStatus('Saved');
    setTimeout(() => setStatus(''), 1500);
  }, [values]);

  const addressPreview = useMemo(() => {
    if (!values) return '';
    return [
      values.authorName,
      values.organization,
      values.address1,
      values.address2,
      [values.city, values.region, values.postalCode].filter(Boolean).join(' '),
      values.country,
    ].filter(Boolean).join('\n');
  }, [values]);

  if (!values) return <div className="p-10 text-muted-foreground">Loading author information...</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="flex items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold">Author Information</h1>
            <p className="text-sm text-muted-foreground mt-1">Tree-level author, contact, copyright, and presentation metadata.</p>
          </div>
          {status && <span className="ml-auto text-xs text-emerald-500">{status}</span>}
          <button onClick={save} className={primaryButton}>Save</button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <main className="space-y-5">
            <Panel title="Family Tree">
              <Grid>
                <Field label="Tree Name"><input value={values.treeName} onChange={(event) => update('treeName', event.target.value)} className={inputClass} /></Field>
                <Field label="Subtitle"><input value={values.subtitle} onChange={(event) => update('subtitle', event.target.value)} className={inputClass} /></Field>
                <Field label="Copyright"><input value={values.copyright} onChange={(event) => update('copyright', event.target.value)} className={inputClass} /></Field>
                <Field label="Tree Icon Media">
                  <select value={values.iconMediaRecordName} onChange={(event) => update('iconMediaRecordName', event.target.value)} className={inputClass}>
                    <option value="">No icon</option>
                    {media.map((record) => (
                      <option key={record.recordName} value={record.recordName}>{mediaLabel(record)}</option>
                    ))}
                  </select>
                </Field>
              </Grid>
            </Panel>

            <Panel title="Author">
              <Grid>
                <Field label="Name"><input value={values.authorName} onChange={(event) => update('authorName', event.target.value)} className={inputClass} /></Field>
                <Field label="Organization"><input value={values.organization} onChange={(event) => update('organization', event.target.value)} className={inputClass} /></Field>
                <Field label="Email"><input type="email" value={values.email} onChange={(event) => update('email', event.target.value)} className={inputClass} /></Field>
                <Field label="Phone"><input value={values.phone} onChange={(event) => update('phone', event.target.value)} className={inputClass} /></Field>
                <Field label="Website"><input type="url" value={values.website} onChange={(event) => update('website', event.target.value)} className={inputClass} /></Field>
              </Grid>
            </Panel>

            <Panel title="Address">
              <Grid>
                <Field label="Address 1"><input value={values.address1} onChange={(event) => update('address1', event.target.value)} className={inputClass} /></Field>
                <Field label="Address 2"><input value={values.address2} onChange={(event) => update('address2', event.target.value)} className={inputClass} /></Field>
                <Field label="City"><input value={values.city} onChange={(event) => update('city', event.target.value)} className={inputClass} /></Field>
                <Field label="State / Region"><input value={values.region} onChange={(event) => update('region', event.target.value)} className={inputClass} /></Field>
                <Field label="Postal Code"><input value={values.postalCode} onChange={(event) => update('postalCode', event.target.value)} className={inputClass} /></Field>
                <Field label="Country"><input value={values.country} onChange={(event) => update('country', event.target.value)} className={inputClass} /></Field>
              </Grid>
            </Panel>

            <Panel title="Notes">
              <textarea value={values.notes} onChange={(event) => update('notes', event.target.value)} rows={6} className={inputClass} />
            </Panel>
          </main>

          <aside className="rounded-lg border border-border bg-card p-5 h-fit">
            <h2 className="text-base font-semibold mb-3">{values.treeName || 'Family Tree'}</h2>
            {values.subtitle && <div className="text-sm text-muted-foreground mb-4">{values.subtitle}</div>}
            <div className="whitespace-pre-line text-sm leading-relaxed">{addressPreview || 'No author contact entered.'}</div>
            {values.website && <a href={values.website} target="_blank" rel="noreferrer" className="block mt-4 text-sm text-primary hover:underline">{values.website}</a>}
            {values.copyright && <div className="mt-4 text-xs text-muted-foreground">{values.copyright}</div>}
          </aside>
        </div>
      </div>
    </div>
  );
}

function mediaLabel(record) {
  return readField(record, ['title', 'caption', 'filename'], record.recordName);
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
const primaryButton = 'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60';
