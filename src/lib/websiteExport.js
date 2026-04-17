/**
 * Static website export — generates a downloadable .zip with one HTML file
 * per person plus an index. Uses the JSZip dep that's already in the project.
 */
import JSZip from 'jszip';
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { personSummary, lifeSpanLabel } from '../models/index.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CSS = `:root{--bg:#f9fafb;--card:#fff;--fg:#1a1d27;--muted:#6b7280;--border:#e5e7eb;--accent:#2563eb}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg);line-height:1.5;padding:24px}
.container{max-width:880px;margin:0 auto}
h1{font-size:28px;margin-bottom:8px}
h2{font-size:20px;margin:24px 0 8px;border-bottom:1px solid var(--border);padding-bottom:4px}
.muted{color:var(--muted);font-size:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)}
th{font-size:12px;text-transform:uppercase;color:var(--muted)}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.person-link{display:block;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:#fff}
header{margin-bottom:24px}
header h1{font-weight:700}
.footer{margin-top:48px;color:var(--muted);font-size:12px;text-align:center}`;

function pageWrap(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="container">${body}<div class="footer">Exported from CloudTreeWeb</div></div></body></html>`;
}

export async function buildSite() {
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  const families = (await db.query('Family', { limit: 100000 })).records;
  const childRels = (await db.query('ChildRelation', { limit: 100000 })).records;
  const personEvents = (await db.query('PersonEvent', { limit: 100000 })).records;

  const personById = new Map(persons.map((p) => [p.recordName, p]));
  const familyById = new Map(families.map((f) => [f.recordName, f]));

  const childrenByFamily = new Map();
  const familiesByPerson = new Map();
  const parentFamilyByChild = new Map();
  for (const cr of childRels) {
    const fam = refToRecordName(cr.fields?.family?.value);
    const ch = refToRecordName(cr.fields?.child?.value);
    if (!fam || !ch) continue;
    if (!childrenByFamily.has(fam)) childrenByFamily.set(fam, []);
    childrenByFamily.get(fam).push(ch);
    parentFamilyByChild.set(ch, fam);
  }
  for (const fam of families) {
    for (const slot of ['man', 'woman']) {
      const ref = refToRecordName(fam.fields?.[slot]?.value);
      if (!ref) continue;
      if (!familiesByPerson.has(ref)) familiesByPerson.set(ref, []);
      familiesByPerson.get(ref).push(fam.recordName);
    }
  }

  const zip = new JSZip();

  // Index page — alphabetical list
  const sorted = [...persons].sort((a, b) => {
    const an = personSummary(a)?.fullName || a.recordName;
    const bn = personSummary(b)?.fullName || b.recordName;
    return an.localeCompare(bn);
  });
  const indexBody = `<header><h1>Family Tree</h1><p class="muted">${persons.length} persons · ${families.length} families</p></header>
    <div class="grid">${sorted.map((p) => {
      const s = personSummary(p);
      return `<a class="person-link" href="people/${p.recordName}.html"><strong>${esc(s.fullName)}</strong><div class="muted">${esc(lifeSpanLabel(s) || '—')}</div></a>`;
    }).join('')}</div>`;
  zip.file('index.html', pageWrap('Family Tree', indexBody));

  // One page per person
  for (const p of persons) {
    const s = personSummary(p);
    const f = p.fields || {};
    const parentFam = parentFamilyByChild.get(p.recordName);
    const parents = parentFam ? (() => {
      const fam = familyById.get(parentFam);
      const m = refToRecordName(fam?.fields?.man?.value);
      const w = refToRecordName(fam?.fields?.woman?.value);
      return [m, w].filter(Boolean).map((id) => personById.get(id)).filter(Boolean);
    })() : [];
    const myFams = (familiesByPerson.get(p.recordName) || []).map((id) => familyById.get(id)).filter(Boolean);
    const events = personEvents.filter((e) => refToRecordName(e.fields?.person?.value) === p.recordName);

    const body = `
      <header>
        <h1>${esc(s.fullName)}</h1>
        <p class="muted">${esc(lifeSpanLabel(s) || '—')}</p>
        <p class="muted"><a href="../index.html">← All people</a></p>
      </header>
      ${parents.length > 0 ? `<h2>Parents</h2><div class="card">${parents.map((pp) => {
        const ps = personSummary(pp);
        return `<div><a href="${pp.recordName}.html">${esc(ps.fullName)}</a> <span class="muted">${esc(lifeSpanLabel(ps) || '')}</span></div>`;
      }).join('')}</div>` : ''}
      ${myFams.length > 0 ? `<h2>Families</h2>${myFams.map((fam) => {
        const partnerId = [refToRecordName(fam.fields?.man?.value), refToRecordName(fam.fields?.woman?.value)].find((id) => id && id !== p.recordName);
        const partner = partnerId ? personById.get(partnerId) : null;
        const ps = partner && personSummary(partner);
        const kids = (childrenByFamily.get(fam.recordName) || []).map((id) => personById.get(id)).filter(Boolean);
        return `<div class="card">
          <div>Partner: ${partner ? `<a href="${partner.recordName}.html">${esc(ps.fullName)}</a>` : '—'}</div>
          ${kids.length > 0 ? `<div style="margin-top:8px"><strong>Children:</strong><ul style="margin-left:18px">${kids.map((c) => {
            const cs = personSummary(c);
            return `<li><a href="${c.recordName}.html">${esc(cs.fullName)}</a> <span class="muted">${esc(lifeSpanLabel(cs) || '')}</span></li>`;
          }).join('')}</ul></div>` : ''}
        </div>`;
      }).join('')}` : ''}
      ${events.length > 0 ? `<h2>Events</h2><table><tbody>${events.map((e) => `
        <tr><td>${esc(refToRecordName(e.fields?.conclusionType?.value) || e.fields?.eventType?.value || 'Event')}</td>
            <td>${esc(e.fields?.date?.value || '')}</td>
            <td>${esc(e.fields?.description?.value || '')}</td></tr>`).join('')}</tbody></table>` : ''}`;

    zip.file(`people/${p.recordName}.html`, pageWrap(s.fullName, body));
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function downloadSite() {
  const blob = await buildSite();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudtreeweb-site-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
