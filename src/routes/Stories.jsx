import React from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';

const FIELDS = [
  { id: 'title', label: 'Title' },
  { id: 'subtitle', label: 'Subtitle' },
  { id: 'author', label: 'Author' },
  { id: 'date', label: 'Date' },
  { id: 'text', label: 'Story text (Markdown)', kind: 'textarea', rows: 18 },
];

export default function Stories() {
  return (
    <SimpleCrudList
      recordType="Story"
      uuidPrefix="story"
      title="Stories"
      fields={FIELDS}
      displayLabel={(r) => r.fields?.title?.value || r.recordName}
      searchPlaceholder="Search stories…"
      emptyText="No stories yet. Add a narrative about a person, family, or event."
    />
  );
}
