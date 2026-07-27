/**
 * /person/new — create a new Person record (optionally linked to an anchor
 * via a relation type) then redirect to the regular PersonEditor.
 *
 * Query params (all optional):
 *   relation: father | mother | partner | son | daughter | brother | sister
 *   anchor:   recordName of the existing person the new one is being added to
 *   partner:  recordName of an existing partner (used when adding son/daughter
 *             through a specific union)
 *   firstName / lastName: optional prefills
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { generateId } from '../lib/ids.js';
import { logRecordCreated } from '../lib/changeLog.js';
import { linkExistingRelative } from '../lib/relativeLinks.js';
import { getAppPreferences } from '../lib/appPreferences.js';
import { refValue } from '../lib/recordRef.js';
import { Gender } from '../models/index.js';
import { Button } from '../components/ui/Button.jsx';

function uuid(prefix) {
  return generateId(prefix);
}

function genderForRelation(relation) {
  switch (relation) {
    case 'father':
    case 'son':
    case 'brother':
      return Gender.Male;
    case 'mother':
    case 'daughter':
    case 'sister':
      return Gender.Female;
    default:
      return Gender.UnknownGender;
  }
}

function relationType(relation) {
  if (relation === 'father' || relation === 'mother') return 'parent';
  if (relation === 'partner') return 'spouse';
  if (relation === 'son' || relation === 'daughter') return 'child';
  if (relation === 'brother' || relation === 'sister') return 'sibling';
  return null;
}

export default function NewPerson() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Creating new person…');
  const [error, setError] = useState(null);
  const ranRef = useRef(false);

  // This route creates a record as a side effect of being visited. That is what
  // the in-app "add relative" and "New person" buttons want, but it also means
  // a bookmark, a typed URL, or a back-navigation silently leaves a blank
  // orphan person in the tree. Create straight away only when the visit
  // carries intent: relation/anchor params, a name prefill, or the marker the
  // in-app buttons pass through navigation state.
  const hasIntent = Boolean(
    params.get('relation') || params.get('anchor') || params.get('partner')
    || params.get('firstName') || params.get('lastName')
    || location.state?.intent === 'create',
  );
  const [confirmed, setConfirmed] = useState(false);

  const create = useCallback(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        const relation = params.get('relation') || '';
        const anchorId = params.get('anchor') || '';
        const firstName = params.get('firstName') || '';
        const lastName = params.get('lastName') || '';
        const db = getLocalDatabase();
        const newRecord = {
          recordName: uuid('person'),
          recordType: 'Person',
          fields: {
            firstName: { value: firstName, type: 'STRING' },
            lastName: { value: lastName, type: 'STRING' },
            gender: { value: genderForRelation(relation), type: 'INT64' },
          },
        };
        await db.saveRecord(newRecord);
        await logRecordCreated(newRecord);

        // Default Values: optionally pre-add the configured default event.
        try {
          const prefs = await getAppPreferences();
          const defaultEvent = prefs.editControllers?.defaultEventType;
          if (prefs.editControllers?.applyDefaultEvents && defaultEvent && defaultEvent !== 'none') {
            const eventRecord = {
              recordName: uuid('pe'),
              recordType: 'PersonEvent',
              fields: {
                person: { value: refValue(newRecord.recordName, 'Person'), type: 'REFERENCE' },
                conclusionType: { value: refValue(defaultEvent, 'ConclusionPersonEventType'), type: 'REFERENCE' },
              },
            };
            await db.saveRecord(eventRecord);
            await logRecordCreated(eventRecord);
          }
        } catch { /* default events are best-effort */ }

        if (anchorId) {
          const linkType = relationType(relation);
          if (linkType) {
            setStatus('Linking to anchor person…');
            // For 'parent' relation, link from child (anchor) to parent (new).
            // For 'child', link from parent (anchor) to child (new).
            // For 'spouse'/'sibling', order doesn't matter.
            try {
              if (linkType === 'parent') {
                await linkExistingRelative(anchorId, newRecord.recordName, 'parent');
              } else if (linkType === 'child') {
                await linkExistingRelative(anchorId, newRecord.recordName, 'child');
              } else {
                await linkExistingRelative(anchorId, newRecord.recordName, linkType);
              }
            } catch (linkError) {
              // Don't fail the whole flow — the user can edit relations manually.
              console.warn('Could not auto-link relation', linkError);
            }
          }
        }
        navigate(`/person/${encodeURIComponent(newRecord.recordName)}`, { replace: true });
      } catch (ex) {
        setError(ex?.message || 'Could not create person.');
      }
    })();
  }, [navigate, params]);

  useEffect(() => {
    if (hasIntent || confirmed) create();
  }, [hasIntent, confirmed, create]);

  const title = 'text-base font-extrabold text-foreground';
  const message = 'text-sm font-semibold text-muted-foreground';

  return (
    <div className="flex items-center justify-center p-10 min-h-[60vh]">
      <div className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card text-card-foreground px-8 py-6 shadow-[0_18px_40px_rgb(0_0_0/0.08)]">
        {!error && !hasIntent && !confirmed ? (
          <>
            <div className={title}>Add a new person?</div>
            <div className={message}>
              This creates an empty person record in your tree, ready to edit.
            </div>
            <Button variant="secondary" size="md" className="mt-2" onClick={() => setConfirmed(true)}>Create person</Button>
            <Button variant="secondary" size="md" className="mt-2" onClick={() => navigate(-1)}>Cancel</Button>
          </>
        ) : error ? (
          <>
            <div className={title}>Could not create person</div>
            <div className={message}>{error}</div>
            <Button variant="secondary" size="md" className="mt-2" onClick={() => navigate(-1)}>Back</Button>
          </>
        ) : (
          <>
            <div className={title}>{status}</div>
            <div className={message}>Hold on a moment…</div>
          </>
        )}
      </div>
    </div>
  );
}
