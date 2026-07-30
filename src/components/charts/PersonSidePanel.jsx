/**
 * Slide-in side panel that shows a read-only summary of a person
 * when you double-click their node in a chart.
 *
 * Keeps weight low — parents, spouses, children, a handful of events
 * and facts. For full editing, the "Open full editor" link jumps to
 * the PersonEditor route.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildPersonContext } from '../../lib/personContext.js';
import { lifeSpanLabel, Gender } from '../../models/index.js';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { useChartSelection } from './ChartSelectionContext.jsx';
import { BdiText, LtrText } from '../BdiText.jsx';
import { Button } from '../ui/Button.jsx';
import { cn } from '../../lib/utils.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

const GENDER_LABEL = {
  [Gender?.Male ?? 0]: 'Male',
  [Gender?.Female ?? 1]: 'Female',
  [Gender?.Unknown ?? 2]: 'Unknown',
  [Gender?.Intersex ?? 3]: 'Intersex',
};

export function PersonSidePanel({
  recordName,
  open,
  onClose,
  onReroot,
  width = 340,
}) {
  const { t } = useTranslation();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const effectiveWidth = isMobile ? '100%' : width;
  const { openPerson } = useChartSelection();
  const openById = (id) => id && openPerson?.({ recordName: id });

  useEffect(() => {
    if (!recordName) {
      setContext(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    buildPersonContext(recordName)
      .then((ctx) => { if (!cancelled) setContext(ctx); })
      .catch(() => { if (!cancelled) setContext(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recordName]);

  const self = context?.selfSummary;
  const span = self ? lifeSpanLabel(self) : '';

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        'flex shrink-0 flex-col overflow-hidden bg-card text-card-foreground',
        open && 'border-s border-border',
        isMobile && open && 'absolute end-0 top-0 z-[25] h-full shadow-xl',
      )}
      // Width animates open/closed and depends on the `width` prop, so it
      // stays inline.
      style={{ width: open ? effectiveWidth : 0, transition: 'width 220ms ease' }}
    >
      <div className="flex h-full flex-col" style={{ width: effectiveWidth }}>
        <header className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs tracking-wide text-muted-foreground">{t('charts.personLabel', { defaultValue: 'PERSON' })}</div>
            <div className="truncate text-[15px] font-semibold">
              <BdiText>{self?.fullName || (loading ? t('common.loading', { defaultValue: 'Loading…' }) : t('charts.noPerson', { defaultValue: 'No person' }))}</BdiText>
            </div>
            {span && <div className="text-xs text-muted-foreground"><LtrText>{span}</LtrText></div>}
          </div>
          <Button variant="outline" size="icon" onClick={onClose} className="text-muted-foreground" aria-label="Close panel">✕</Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3.5">
          {!self && !loading && (
            <div className="text-sm text-muted-foreground">{t('charts.personNotFound', { defaultValue: 'Person not found.' })}</div>
          )}

          {self && (
            <>
              <Section label="Details">
                <Row label="Gender" value={GENDER_LABEL[self.gender] || '—'} />
                <Row label="Born" value={formatDate(self.birthDate) || '—'} />
                <Row label="Died" value={formatDate(self.deathDate) || '—'} />
              </Section>

              {context.parents.length > 0 && (
                <Section label="Parents">
                  {context.parents.map((fam) => (
                    <div key={fam.family.recordName} className="mb-1">
                      {fam.man && <PersonLine person={fam.man} onOpen={openById} />}
                      {fam.woman && <PersonLine person={fam.woman} onOpen={openById} />}
                    </div>
                  ))}
                </Section>
              )}

              {context.families.length > 0 && (
                <Section label={context.families.length > 1 ? 'Spouses & children' : 'Spouse & children'}>
                  {context.families.map((fam) => (
                    <div key={fam.family.recordName} className="mb-2.5">
                      {fam.partner && <PersonLine person={fam.partner} onOpen={openById} bold />}
                      {fam.children.length > 0 && (
                        <div className="ms-3.5 mt-0.5">
                          {fam.children.map((child) => (
                            <PersonLine key={child.recordName} person={child} onOpen={openById} muted />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {context.events.length > 0 && (
                <Section label="Events">
                  {context.events.slice(0, 8).map((ev) => (
                    <Row
                      key={ev.recordName}
                      label={readField(ev, 'eventType') || 'Event'}
                      value={readField(ev, 'date') || readField(ev, 'place') || ''}
                    />
                  ))}
                </Section>
              )}

              {context.facts.length > 0 && (
                <Section label="Facts">
                  {context.facts.slice(0, 6).map((ft) => (
                    <Row
                      key={ft.recordName}
                      label={readField(ft, 'factType') || 'Fact'}
                      value={readField(ft, 'value') || ''}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {self && (
          <footer className="flex flex-col gap-2 border-t border-border px-4 py-3">
            <Button variant="primary" size="md" onClick={() => onReroot && onReroot(self.recordName)}>
              Re-root chart here
            </Button>
            <Link to={`/person/${encodeURIComponent(self.recordName)}`} className="px-3 py-1.5 text-center text-sm text-interactive no-underline">
              Open full editor →
            </Link>
          </footer>
        )}
      </div>
    </aside>
  );
}

function Section({ label, children }) {
  return (
    <div className="mb-3.5">
      <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex min-w-0 gap-2 py-0.5 text-sm">
      <div className="w-20 shrink-0 text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 truncate">
        <BdiText>{value}</BdiText>
      </div>
    </div>
  );
}

function PersonLine({ person, bold, muted, onOpen }) {
  const span = lifeSpanLabel(person);
  const clickable = !!(onOpen && person?.recordName);
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={clickable ? () => onOpen(person.recordName) : undefined}
      className={cn(
        'block w-full truncate bg-transparent p-0 py-0.5 text-start text-sm',
        bold ? 'font-semibold' : 'font-normal',
        muted ? 'text-muted-foreground' : 'text-foreground',
        clickable ? 'cursor-pointer hover:underline' : 'cursor-default',
      )}
    >
      <BdiText>{person.fullName}</BdiText>
      {span && (
        <span className="ms-1.5 text-muted-foreground">
          <LtrText>{span}</LtrText>
        </span>
      )}
    </Tag>
  );
}

function formatDate(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (raw.year) return String(raw.year);
  return '';
}

function readField(record, name) {
  const v = record?.fields?.[name]?.value;
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (v.value != null) return String(v.value);
  return '';
}

export default PersonSidePanel;
