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
        <h1 className="text-base font-semibold me-2">Templates &amp; Types</h1>
        {TEMPLATE_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground border border-border hover:bg-accent'}`}>
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
