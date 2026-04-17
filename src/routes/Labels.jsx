import React from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';

const FIELDS = [
  { id: 'name', label: 'Label name' },
  { id: 'color', label: 'Color (any CSS value, e.g. rgb(220 38 38) or #ef4444)' },
  { id: 'description', label: 'Description', kind: 'textarea', rows: 3 },
];

export default function Labels() {
  return (
    <SimpleCrudList
      recordType="Label"
      uuidPrefix="lbl"
      title="Labels"
      fields={FIELDS}
      displayLabel={(r) => r.fields?.name?.value || r.recordName}
      searchPlaceholder="Search labels…"
      emptyText="No custom labels yet. Three built-in labels (Incomplete, Important, Noteworthy) are also available in record editors."
    />
  );
}
