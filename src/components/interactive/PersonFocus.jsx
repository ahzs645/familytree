/**
 * Right-pane focus view for a single person — parents / partners / children / events,
 * each as a clickable chip that re-focuses the pane. Summaries arrive from
 * buildPersonContext() already converted via models/wrap.js.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Gender, genderLabel, lifeSpanLabel } from '../../models/index.js';
import { eventTypeLabel } from '../../lib/catalogs.js';
import { MiniTimeline } from '../MiniTimeline.jsx';
import { BdiText, LtrText } from '../BdiText.jsx';
import { Button } from '../ui/Button.jsx';

const humanizeConclusionLabel = (raw) => eventTypeLabel(raw);

// Semi-transparent fills work on both light and dark backgrounds.
const CHIP_COLORS = {
  [Gender.Male]: ['hsl(215 80% 55% / 0.18)', 'hsl(215 80% 55% / 0.6)'],
  [Gender.Female]: ['hsl(330 70% 55% / 0.18)', 'hsl(330 70% 55% / 0.6)'],
  [Gender.UnknownGender]: ['hsl(var(--muted))', 'hsl(var(--border))'],
  [Gender.Intersex]: ['hsl(280 60% 55% / 0.18)', 'hsl(280 60% 55% / 0.6)'],
};

function Chip({ person, onPick }) {
  if (!person) {
    return (
      <div className="min-w-[160px] rounded-md border border-dashed border-border bg-muted px-3.5 py-2.5 text-muted-foreground">
        Unknown
      </div>
    );
  }
  const [fill, stroke] = CHIP_COLORS[person.gender] || CHIP_COLORS[Gender.UnknownGender];
  return (
    <div
      onClick={() => onPick(person.recordName)}
      className="min-w-[160px] cursor-pointer rounded-md border px-3.5 py-2.5 text-foreground transition-[filter] hover:brightness-[1.15]"
      style={{ background: fill, borderColor: stroke }}
    >
      <div className="text-sm font-semibold text-foreground"><BdiText>{person.fullName}</BdiText></div>
      <div className="text-xs text-muted-foreground"><LtrText>{lifeSpanLabel(person)}</LtrText></div>
    </div>
  );
}

function Section({ title, children, count }) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-foreground">
        {title} {count != null && <span className="font-normal text-muted-foreground">· {count}</span>}
      </div>
      {children}
    </div>
  );
}

export function PersonFocus({ context, onPick, onOpenAncestorChart, onOpenDescendantChart }) {
  const navigate = useNavigate();
  if (!context) {
    return <div className="p-10 text-muted-foreground">Pick a person from the list.</div>;
  }
  const self = context.selfSummary;
  const parents = context.parents.flatMap((fam) => [fam.man, fam.woman]).filter(Boolean);
  const partners = context.families.map((f) => f.partner).filter(Boolean);
  const children = context.families.flatMap((f) => f.children).filter(Boolean);

  return (
    <div className="h-full overflow-auto p-7">
      <div className="mb-6 border-b border-border pb-5">
        <div className="text-[22px] font-bold text-foreground"><BdiText>{self.fullName}</BdiText></div>
        <div className="mt-1 text-sm text-muted-foreground">
          <LtrText>{lifeSpanLabel(self) || 'No life dates'}</LtrText> · {genderLabel(self.gender)}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => navigate(`/person/${self.recordName}`)}>Edit person</Button>
          <Button onClick={() => onOpenAncestorChart(self.recordName)}>Ancestor chart</Button>
          <Button onClick={() => onOpenDescendantChart(self.recordName)}>Descendant chart</Button>
        </div>
      </div>

      <Section title="Parents" count={parents.length}>
        {parents.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No parents recorded.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">{parents.map((p) => <Chip key={p.recordName} person={p} onPick={onPick} />)}</div>
        )}
      </Section>

      <Section title="Partners" count={partners.length}>
        {partners.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No partners recorded.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">{partners.map((p) => <Chip key={p.recordName} person={p} onPick={onPick} />)}</div>
        )}
        {context.families.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {context.families.map((fam) => (
              <Button
                key={fam.family.recordName}
                variant="outline"
                className="text-primary"
                onClick={() => navigate(`/family/${fam.family.recordName}`)}
              >
                Edit family with {fam.partner?.fullName ? <BdiText>{fam.partner.fullName}</BdiText> : '?'}
              </Button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Children" count={children.length}>
        {children.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No children recorded.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">{children.map((p) => <Chip key={p.recordName} person={p} onPick={onPick} />)}</div>
        )}
      </Section>

      <Section title="Events" count={context.events.length}>
        {context.events.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No events recorded.</div>
        ) : (
          <>
            <div className="mb-3">
              <MiniTimeline
                events={context.events.map((e) => ({
                  label: humanizeConclusionLabel(e.fields?.conclusionType?.value || e.fields?.eventType?.value),
                  date: e.fields?.date?.value,
                }))}
              />
            </div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {context.events.map((e) => (
                  <tr key={e.recordName}>
                    <td className="w-[28%] py-1.5 text-foreground">{humanizeConclusionLabel(e.fields?.conclusionType?.value || e.fields?.eventType?.value)}</td>
                    <td className="w-[18%] px-2 py-1.5 text-muted-foreground">{e.fields?.date?.value || '—'}</td>
                    <td className="py-1.5 text-muted-foreground">{e.fields?.description?.value || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>
    </div>
  );
}

export default PersonFocus;
