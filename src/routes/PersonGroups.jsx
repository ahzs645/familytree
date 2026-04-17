import React from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';

const FIELDS = [
  { id: 'name', label: 'Group name' },
  { id: 'description', label: 'Description', kind: 'textarea', rows: 3 },
  { id: 'color', label: 'Color (any CSS value)' },
];

export default function PersonGroups() {
  return (
    <SimpleCrudList
      recordType="PersonGroup"
      uuidPrefix="grp"
      title="Person Groups"
      fields={FIELDS}
      displayLabel={(r) => r.fields?.name?.value || r.recordName}
      searchPlaceholder="Search groups…"
      emptyText="No person groups yet. Use groups to collect persons under any label (e.g. cousins, ancestors of interest)."
    />
  );
}
