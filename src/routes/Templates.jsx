/**
 * Templates editor — manage SourceTemplate, PlaceTemplate, and the various
 * ConclusionType records (event / fact / additional name) in one place.
 */
import React, { useState } from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';

const TABS = [
  { id: 'SourceTemplate', label: 'Source Templates', uuidPrefix: 'srctpl' },
  { id: 'SourceTemplateKey', label: 'Source Template Keys', uuidPrefix: 'srctplkey' },
  { id: 'SourceTemplateKeyRelation', label: 'Source Template Key Relations', uuidPrefix: 'srctplrel' },
  { id: 'PlaceTemplate', label: 'Place Templates', uuidPrefix: 'plctpl' },
  { id: 'ConclusionPersonEventType', label: 'Person Event Types', uuidPrefix: 'cpet' },
  { id: 'ConclusionFamilyEventType', label: 'Family Event Types', uuidPrefix: 'cfet' },
  { id: 'ConclusionPersonFactType', label: 'Person Fact Types', uuidPrefix: 'cpft' },
  { id: 'ConclusionAdditionalNameType', label: 'Additional Name Types', uuidPrefix: 'cant' },
];

const FIELDS = [
  { id: 'name', label: 'Name' },
  { id: 'typeName', label: 'Type name' },
  { id: 'title', label: 'Display title' },
  { id: 'order', label: 'Order', type: 'number' },
  { id: 'description', label: 'Description', kind: 'textarea', rows: 3 },
];

export default function Templates() {
  const [tab, setTab] = useState(TABS[0].id);
  const def = TABS.find((t) => t.id === tab);
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card flex-wrap">
        <h1 className="text-base font-semibold mr-2">Templates &amp; Types</h1>
        {TABS.map((t) => (
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
          fields={FIELDS}
          displayLabel={(r) => r.fields?.name?.value || r.fields?.typeName?.value || r.fields?.title?.value || r.recordName}
          searchPlaceholder={`Search ${def.label.toLowerCase()}…`}
          emptyText={`No ${def.label.toLowerCase()} yet.`}
        />
      </div>
    </div>
  );
}
