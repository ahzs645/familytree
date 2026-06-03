import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { looksLikeGeneWebText, parseGeneWeb } from './gwImport.js';
import { refToRecordName } from './gwShared.js';

const SAMPLE = `encoding: utf-8
gwplus

fam Doe John +1/1/1900 Smith Jane 1875 od
fevt
#marr 1/1/1900 #p London #s parish
end fevt
beg
- m Jack 1901 1980
- f Jill #occu Weaver 1903 od
end

notes Doe John
beg
Line one
Line two with [[Jane/Smith]]
end notes

pevt Doe John
#birt 1870 #p Dublin
#deat 1940
end pevt
`;

describe('GeneWeb import', () => {
  it('detects common .gw content', () => {
    expect(looksLikeGeneWebText(SAMPLE)).toBe(true);
    expect(looksLikeGeneWebText('0 HEAD\n1 CHAR UTF-8')).toBe(false);
  });

  it('parses common family, child, event, and note blocks', () => {
    const records = parseGeneWeb(SAMPLE);
    const persons = records.filter((record) => record.recordType === 'Person');
    const family = records.find((record) => record.recordType === 'Family');
    const childRelations = records.filter((record) => record.recordType === 'ChildRelation');
    const events = records.filter((record) => record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent');
    const note = records.find((record) => record.recordType === 'Note');

    expect(persons.map((person) => person.fields.cached_fullName.value)).toEqual(
      expect.arrayContaining(['John Doe', 'Jane Smith', 'Jack Doe', 'Jill Doe']),
    );
    expect(family.fields.cached_marriageDate.value).toBe('1/1/1900');
    expect(childRelations).toHaveLength(2);
    expect(refToRecordName(childRelations[0].fields.family)).toBe(family.recordName);
    expect(events.map((event) => event.fields.conclusionType.value)).toEqual(
      expect.arrayContaining(['Marriage', 'Birth', 'Death']),
    );
    expect(note.fields.text.value).toContain('Line two');
  });

  it('smoke parses the local GeneWeb galichet fixture when present', () => {
    const fixture = '/Users/ahmadjalil/Downloads/geneweb-master/test/galichet.gw';
    if (!fs.existsSync(fixture)) return;

    const records = parseGeneWeb(fs.readFileSync(fixture, 'utf8'));

    expect(records.filter((record) => record.recordType === 'Person').length).toBeGreaterThan(20);
    expect(records.filter((record) => record.recordType === 'Family').length).toBeGreaterThan(5);
    expect(records.some((record) => record.recordType === 'Note' && record.fields.text.value.includes('apostrophe'))).toBe(true);
  });
});

