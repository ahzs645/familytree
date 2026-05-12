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
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { logRecordCreated } from '../lib/changeLog.js';
import { linkExistingRelative } from '../lib/relativeLinks.js';
import { Gender } from '../models/index.js';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
  const [status, setStatus] = useState('Creating new person…');
  const [error, setError] = useState(null);
  const ranRef = useRef(false);

  useEffect(() => {
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

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        {error ? (
          <>
            <div style={titleStyle}>Could not create person</div>
            <div style={messageStyle}>{error}</div>
            <button type="button" style={buttonStyle} onClick={() => navigate(-1)}>Back</button>
          </>
        ) : (
          <>
            <div style={titleStyle}>{status}</div>
            <div style={messageStyle}>Hold on a moment…</div>
          </>
        )}
      </div>
    </div>
  );
}

const shellStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  minHeight: '60vh',
};

const cardStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  alignItems: 'center',
  padding: '24px 32px',
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  boxShadow: '0 18px 40px rgb(0 0 0 / 0.08)',
};

const titleStyle = {
  font: '800 16px -apple-system, system-ui, sans-serif',
  color: 'hsl(var(--foreground))',
};

const messageStyle = {
  color: 'hsl(var(--muted-foreground))',
  font: '600 13px -apple-system, system-ui, sans-serif',
};

const buttonStyle = {
  marginTop: 8,
  height: 32,
  padding: '0 14px',
  borderRadius: 6,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--secondary))',
  cursor: 'pointer',
};
