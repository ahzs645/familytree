import React from 'react';
import { SimpleCrudList } from '../components/editors/SimpleCrudList.jsx';

const FIELDS = [
  { id: 'testName', label: 'Test name' },
  { id: 'testType', label: 'Test type', kind: 'select', options: [
    { value: '', label: '—' },
    { value: 'Autosomal', label: 'Autosomal DNA' },
    { value: 'Y-DNA', label: 'Y-DNA (paternal line)' },
    { value: 'mtDNA', label: 'mtDNA (maternal line)' },
    { value: 'X-DNA', label: 'X-DNA' },
    { value: 'Other', label: 'Other' },
  ] },
  { id: 'lab', label: 'Lab / provider' },
  { id: 'date', label: 'Test date' },
  { id: 'kitNumber', label: 'Kit / reference number' },
  { id: 'haplogroup', label: 'Haplogroup' },
  { id: 'note', label: 'Notes', kind: 'textarea', rows: 4 },
];

export default function DNAResults() {
  return (
    <SimpleCrudList
      recordType="DNATestResult"
      uuidPrefix="dna"
      title="DNA Results"
      fields={FIELDS}
      displayLabel={(r) => r.fields?.testName?.value || r.fields?.lab?.value || r.recordName}
      searchPlaceholder="Search DNA results…"
      emptyText="No DNA test results yet."
    />
  );
}
