import React from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';

const FIELDS = [
  { id: 'name', label: 'Repository name' },
  { id: 'address', label: 'Address', kind: 'textarea', rows: 3 },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'website', label: 'Website' },
  { id: 'note', label: 'Notes', kind: 'textarea', rows: 4 },
];

export default function SourceRepositories() {
  return (
    <SimpleCrudList
      recordType="SourceRepository"
      uuidPrefix="repo"
      title="Source Repositories"
      fields={FIELDS}
      displayLabel={(r) => r.fields?.name?.value || r.recordName}
      searchPlaceholder="Search repositories…"
      emptyText="No source repositories yet. Add one for archives, libraries, or registries."
    />
  );
}
