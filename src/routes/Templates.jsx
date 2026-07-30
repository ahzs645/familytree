/**
 * Templates editor — manage SourceTemplate, PlaceTemplate, and the various
 * ConclusionType records (event / fact / additional name) in one place.
 */
import React, { useState } from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import {
  TEMPLATE_TABS,
  templateFieldsForType,
  templateRecordLabel,
} from '../lib/templateDefinitions.js';

export default function Templates() {
  const [tab, setTab] = useState(TEMPLATE_TABS[0].id);
  const def = TEMPLATE_TABS.find((t) => t.id === tab);
  return (
    <div className="flex flex-col h-full">
      {/* Ten tabs wrapped onto eight rows at 390px — 63% of the screen before
          any content. They scroll as one strip instead, the same pattern the
          editor section nav and the chart option tabs use, with the edge fade
          so the overflow reads as scrollable rather than as all there is.

          The selected tab carries a transparent border rather than none:
          without it its border-box is 2px shorter than its neighbours, so the
          active tab sat lower than the rest of the row. */}
      <header className="border-b border-border bg-card px-3 py-2 md:px-5 md:py-3">
        <PageTitle className="mb-2 text-base font-semibold">Templates &amp; Types</PageTitle>
        <div className="scroll-fade-inline-end -mx-3 md:-mx-5">
          <div className="no-scrollbar flex snap-x scroll-px-3 items-center gap-2 overflow-x-auto px-3 md:px-5" role="tablist">
            {TEMPLATE_TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id}
                className={`inline-flex h-8 shrink-0 snap-start items-center rounded-md border px-3 text-xs font-medium ${tab === t.id ? 'bg-primary text-primary-foreground border-transparent' : 'bg-secondary text-foreground border-border hover:bg-accent'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <SimpleCrudList
          key={tab}
          recordType={def.id}
          uuidPrefix={def.uuidPrefix}
          title={def.label}
          fields={templateFieldsForType(def.id)}
          displayLabel={templateRecordLabel}
          searchPlaceholder={`Search ${def.label.toLowerCase()}…`}
          emptyText={`No ${def.label.toLowerCase()} yet.`}
        />
      </div>
    </div>
  );
}
