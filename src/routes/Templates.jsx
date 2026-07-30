/**
 * Templates editor — manage SourceTemplate, PlaceTemplate, and the various
 * ConclusionType records (event / fact / additional name) in one place.
 */
import React, { useState } from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';
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
      <header className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card flex-wrap">
        <h2 className="text-base font-semibold me-2">Templates &amp; Types</h2>
        {/* The selected tab carries a transparent border rather than none:
            without it its border-box is 2px shorter than its neighbours, so the
            active tab sat lower than the rest of the row. */}
        {TEMPLATE_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium border ${tab === t.id ? 'bg-primary text-primary-foreground border-transparent' : 'bg-secondary text-foreground border-border hover:bg-accent'}`}>
            {t.label}
          </button>
        ))}
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
