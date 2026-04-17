import React from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';

const FIELDS = [
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status', kind: 'select', options: [
    { value: 'Open', label: 'Open' },
    { value: 'InProgress', label: 'In progress' },
    { value: 'Done', label: 'Done' },
    { value: 'Blocked', label: 'Blocked' },
  ] },
  { id: 'priority', label: 'Priority', kind: 'select', options: [
    { value: 'Low', label: 'Low' },
    { value: 'Normal', label: 'Normal' },
    { value: 'High', label: 'High' },
  ] },
  { id: 'dueDate', label: 'Due date' },
  { id: 'description', label: 'Description', kind: 'textarea', rows: 5 },
];

export default function ToDos() {
  return (
    <SimpleCrudList
      recordType="ToDo"
      uuidPrefix="todo"
      title="ToDos"
      fields={FIELDS}
      displayLabel={(r) => {
        const t = r.fields?.title?.value || r.recordName;
        const s = r.fields?.status?.value;
        return s && s !== 'Done' ? `${t}` : `✓ ${t}`;
      }}
      searchPlaceholder="Search todos…"
      emptyText="No research todos yet."
      extraDefaults={{
        status: { value: 'Open', type: 'STRING' },
        priority: { value: 'Normal', type: 'STRING' },
      }}
    />
  );
}
