import { describe, expect, it } from 'vitest';
import { analyzeGedcomText, buildGedcomDataset, canImportGedcomAnalysis, parseGedcom, tokenizeGedcomText } from './gedcomImport.js';
import { decodeGedcomBytes } from './genealogyFileFormats.js';

describe('analyzeGedcomText', () => {
  it('reports duplicate XREFs as blocking shared validation issues', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 5.5.1',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '0 @I1@ INDI',
      '1 NAME Duplicate /Doe/',
      '0 TRLR',
    ].join('\n'));

    expect(result.canImport).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'gedcom-import',
        code: 'duplicate-xref',
        severity: 'error',
        blocking: true,
        line: 6,
      }),
    ]));
  });

  it('reports unresolved record pointers without blocking import', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '0 @F1@ FAM',
      '1 HUSB @I404@',
      '0 TRLR',
    ].join('\n'));

    expect(result.canImport).toBe(true);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'unresolved-xref',
        severity: 'warning',
        line: 3,
        refs: ['@I404@'],
      }),
    ]));
  });

  it('keeps existing GEDCOM summary counts', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 OBJE @M1@',
      '0 @M1@ OBJE',
      '1 FILE portrait.jpg',
      '0 TRLR',
    ].join('\n'));

    expect(result.counts).toMatchObject({ INDI: 1, FAM: 0, SOUR: 0, OBJE: 2 });
    expect(result.issues.some((issue) => issue.code === 'media-resource-matching')).toBe(true);
  });

  it('reports structural token diagnostics before import mapping', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '1 SOUR Test',
      '3 VERS bad jump',
      '0 CONT orphan',
      '0 TRLR',
    ].join('\n'));

    expect(result.canImport).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'level-jump', severity: 'error', line: 3 }),
      expect.objectContaining({ code: 'orphan-continuation', severity: 'error', line: 4 }),
    ]));
  });

  it('tracks custom tags and continuation usage for review', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 NOTE first',
      '2 CONT second',
      '1 _UID abc123',
      '0 TRLR',
    ].join('\n'));

    expect(result.counts).toMatchObject({ customTags: 1, continuations: 1 });
    expect(result.tags).toContain('_UID');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'custom-tags', severity: 'warning', refs: ['_UID'] }),
    ]));
  });

  it('summarizes unsupported GeneWeb/GEDCOM tags for review', () => {
    const result = analyzeGedcomText([
      '0 HEAD',
      '1 CHAR ASCII',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 _UID abc123',
      '1 _MILT Militia roll',
      '0 @X1@ _FOO',
      '1 NAME /Unsupported/',
      '0 TRLR',
    ].join('\n'));

    expect(result.canImport).toBe(true);
    expect(result.counts.unsupportedTags).toBeGreaterThanOrEqual(2);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported-top-level-record', refs: ['_FOO'] }),
      expect.objectContaining({ code: 'unsupported-event-tag', refs: ['_MILT'] }),
      expect.objectContaining({ code: 'unsupported-tags-summary', refs: expect.arrayContaining(['_FOO', '_MILT']) }),
    ]));
  });
});

describe('tokenizeGedcomText', () => {
  it('keeps line numbers on valid tokens and reports malformed lines', () => {
    const result = tokenizeGedcomText(['0 HEAD', 'not gedcom', '0 TRLR'].join('\n'));

    expect(result.tokens.map((token) => [token.line, token.level, token.tag])).toEqual([
      [1, 0, 'HEAD'],
      [3, 0, 'TRLR'],
    ]);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'gedcom-syntax', line: 2, severity: 'error' }),
    ]));
  });

  it('accepts legacy CR-only line endings', () => {
    const result = tokenizeGedcomText(['0 HEAD', '1 CHAR UTF-8', '0 @I1@ INDI', '1 NAME Jane /Doe/', '0 TRLR'].join('\r'));

    expect(result.issues).toEqual([]);
    expect(result.tokens.map((token) => [token.line, token.level, token.tag])).toEqual([
      [1, 0, 'HEAD'],
      [2, 1, 'CHAR'],
      [3, 0, 'INDI'],
      [4, 1, 'NAME'],
      [5, 0, 'TRLR'],
    ]);
  });

  it('normalizes escaped at-signs and ignores meaningless XREFs on continuations', () => {
    const result = tokenizeGedcomText([
      '0 @N1@ NOTE Email jane@@example.test',
      '1 @VOID@ CONC  and @literal@ text',
    ].join('\n'));

    expect(result.issues).toEqual([]);
    expect(result.tokens.map((token) => [token.line, token.xref, token.tag, token.value])).toEqual([
      [1, '@N1@', 'NOTE', 'Email jane@example.test'],
      [2, null, 'CONC', 'and @literal@ text'],
    ]);
  });
});

describe('canImportGedcomAnalysis', () => {
  it('applies strict, review, and lenient import modes', () => {
    const warningOnly = analyzeGedcomText([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 _UID abc123',
      '0 TRLR',
    ].join('\n'));
    const syntaxError = analyzeGedcomText(['0 HEAD', 'not gedcom', '0 TRLR'].join('\n'));
    const duplicate = analyzeGedcomText(['0 HEAD', '0 @I1@ INDI', '0 @I1@ INDI', '0 TRLR'].join('\n'));

    expect(canImportGedcomAnalysis(warningOnly, 'strict')).toBe(false);
    expect(canImportGedcomAnalysis(warningOnly, 'review')).toBe(true);
    expect(canImportGedcomAnalysis(syntaxError, 'review')).toBe(false);
    expect(canImportGedcomAnalysis(syntaxError, 'lenient')).toBe(true);
    expect(canImportGedcomAnalysis(duplicate, 'lenient')).toBe(false);
  });
});

describe('parseGedcom', () => {
  it('imports the simple GeneWeb GEDCOM fixture shape', () => {
    const records = parseGedcom([
      '0 HEAD',
      '1 CHAR ASCII',
      '1 SOUR ID_OF_CREATING_FILE',
      '1 GEDC',
      '2 VERS 5.5',
      '2 FORM Lineage-Linked',
      '1 SUBM @SUBMITTER@',
      '0 @SUBMITTER@ SUBM',
      '1 NAME /Submitter/',
      '1 ADDR Submitters address',
      '2 CONT address continued here',
      '0 @FATHER@ INDI',
      '1 NAME /Father/',
      '1 SEX M',
      '1 BIRT',
      '2 PLAC birth place',
      '2 DATE 1 JAN 1899',
      '1 DEAT',
      '2 PLAC death place',
      '2 DATE 31 DEC 1990',
      '1 FAMS @FAMILY@',
      '0 @MOTHER@ INDI',
      '1 NAME /Mother/',
      '1 SEX F',
      '1 BIRT',
      '2 PLAC birth place',
      '2 DATE 1 JAN 1899',
      '1 DEAT',
      '2 PLAC death place',
      '2 DATE 31 DEC 1990',
      '1 FAMS @FAMILY@',
      '0 @CHILD@ INDI',
      '1 NAME /Child/',
      '1 BIRT',
      '2 PLAC birth place',
      '2 DATE 31 JUL 1950',
      '1 DEAT',
      '2 PLAC death place',
      '2 DATE 29 FEB 2000',
      '1 FAMC @FAMILY@',
      '0 @FAMILY@ FAM',
      '1 MARR',
      '2 PLAC marriage place',
      '2 DATE 1 APR 1950',
      '1 HUSB @FATHER@',
      '1 WIFE @MOTHER@',
      '1 CHIL @CHILD@',
      '0 TRLR',
    ].join('\r\n'));

    expect(records.filter((record) => record.recordType === 'Person')).toHaveLength(3);
    expect(records.filter((record) => record.recordType === 'Family')).toHaveLength(1);
    expect(records.filter((record) => record.recordType === 'ChildRelation')).toHaveLength(1);
    expect(records.filter((record) => record.recordType === 'PersonEvent')).toHaveLength(6);
    expect(records.filter((record) => record.recordType === 'FamilyEvent')).toHaveLength(1);
    expect(records.find((record) => record.recordType === 'Family')?.fields?.man?.value).toMatch(/^person-imp-/);
  });

  it('round-trips CONT and CONC note text into imported note records', () => {
    const records = parseGedcom([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 NOTE first line',
      '2 CONT second ',
      '2 CONC line',
      '0 TRLR',
    ].join('\n'));

    const note = records.find((record) => record.recordType === 'Note');
    expect(note?.fields?.text?.value).toBe('first line\nsecond line');
  });

  it('preserves unknown GEDCOM subtrees on imported records', () => {
    const records = parseGedcom([
      '0 HEAD',
      '0 @I9@ INDI',
      '1 NAME Jane /Doe/',
      '1 _UID abc123',
      '1 BIRT',
      '2 DATE 1900',
      '2 _ORIG imported birth note',
      '0 @F1@ FAM',
      '1 HUSB @I9@',
      '1 _REL custom family metadata',
      '0 TRLR',
    ].join('\n'));

    const person = records.find((record) => record.recordType === 'Person');
    const birth = records.find((record) => record.recordType === 'PersonEvent');
    const family = records.find((record) => record.recordType === 'Family');

    expect(person?.fields?.gedcomXref?.value).toBe('@I9@');
    expect(person?.fields?.gedcomExtensions?.value).toEqual([
      expect.objectContaining({ tag: '_UID', value: 'abc123' }),
    ]);
    expect(birth?.fields?.gedcomExtensions?.value).toEqual([
      expect.objectContaining({ tag: '_ORIG', value: 'imported birth note' }),
    ]);
    expect(family?.fields?.gedcomExtensions?.value).toEqual([
      expect.objectContaining({ tag: '_REL', value: 'custom family metadata' }),
    ]);
  });

  it('imports repositories and links them to sources', () => {
    const records = parseGedcom([
      '0 HEAD',
      '0 @S1@ SOUR',
      '1 TITL Birth Register',
      '1 REPO @R1@',
      '0 @R1@ REPO',
      '1 NAME County Archive',
      '1 ADDR 123 Archive Rd',
      '2 CITY Salem',
      '1 PHON 555-0100',
      '1 EMAIL archive@example.test',
      '0 TRLR',
    ].join('\n'));

    const repo = records.find((record) => record.recordType === 'SourceRepository');
    const source = records.find((record) => record.recordType === 'Source');

    expect(repo?.fields).toMatchObject({
      name: { value: 'County Archive' },
      address: { value: '123 Archive Rd\nSalem' },
      phone: { value: '555-0100' },
      email: { value: 'archive@example.test' },
    });
    expect(source?.fields?.sourceRepository?.value).toBe(`${repo.recordName}---SourceRepository`);
  });

  it('imports aliases, associates, contact facts, attributes, and source relations', () => {
    const records = parseGedcom([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 ALIA J. Doe',
      '1 PHON 555-1111',
      '1 EMAIL jane@example.test',
      '1 SSN 123-45-6789',
      '1 FACT Blue ribbon winner',
      '2 TYPE Award',
      '1 EDUC University',
      '2 DATE 1998',
      '1 SOUR @S1@',
      '2 PAGE certificate 12',
      '1 ASSO @I2@',
      '2 RELA Witness',
      '0 @I2@ INDI',
      '1 NAME Alex /Roe/',
      '0 @S1@ SOUR',
      '1 TITL Certificate Index',
      '0 TRLR',
    ].join('\n'));

    const person = records.find((record) => record.recordType === 'Person' && record.fields?.gedcomXref?.value === '@I1@');
    const alias = records.find((record) => record.recordType === 'AdditionalName');
    const facts = records.filter((record) => record.recordType === 'PersonFact');
    const education = records.find((record) => record.recordType === 'PersonEvent' && record.fields?.conclusionType?.value === 'Education');
    const sourceRelation = records.find((record) => record.recordType === 'SourceRelation');
    const associate = records.find((record) => record.recordType === 'AssociateRelation');

    expect(alias?.fields).toMatchObject({
      person: { value: `${person.recordName}---Person` },
      conclusionType: { value: 'NameVariation' },
      name: { value: 'J. Doe' },
    });
    expect(facts.map((fact) => [fact.fields.conclusionType.value, fact.fields.description?.value])).toEqual(expect.arrayContaining([
      ['Phone', '555-1111'],
      ['Email', 'jane@example.test'],
      ['SocialSecurityNumber', '123-45-6789'],
      ['Award', 'Blue ribbon winner'],
    ]));
    expect(education?.fields).toMatchObject({
      date: { value: '1998' },
    });
    expect(sourceRelation?.fields).toMatchObject({
      target: { value: `${person.recordName}---Person` },
      page: { value: 'certificate 12' },
    });
    expect(associate?.fields).toMatchObject({
      sourcePerson: { value: `${person.recordName}---Person` },
      relationType: { value: 'Witness' },
    });
  });

  it('stamps GEDCOM SourceRelation records with lineage batch and event records', () => {
    const dataset = buildGedcomDataset([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 SOUR @S1@',
      '2 PAGE certificate 12',
      '0 @S1@ SOUR',
      '1 TITL Certificate Index',
      '0 TRLR',
    ].join('\n'), { sourceName: 'lineage.ged' });
    const records = Object.values(dataset.records);
    const rel = records.find((record) => record.recordType === 'SourceRelation');
    const batch = records.find((record) => record.recordType === 'LineageBatch');
    const event = records.find((record) => record.recordType === 'LineageEvent');

    expect(batch?.fields.kind.value).toBe('gedcomImport');
    expect(event?.fields.eventType.value).toBe('imported');
    expect(rel?.fields.lineageBatch.value).toBe(`${batch.recordName}---LineageBatch`);
    expect(rel?.fields.lineageCreatedByEvent.value).toBe(`${event.recordName}---LineageEvent`);
    expect(rel?.fields.lineageSourceRecord.value).toBe('@S1@');
  });

  it('uses HEAD.PLAC.FORM to create structured place records for event places', () => {
    const records = parseGedcom([
      '0 HEAD',
      '1 PLAC',
      '2 FORM City, County, State, Country',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 BIRT',
      '2 DATE 1900',
      '2 PLAC Salem, Essex, Massachusetts, USA',
      '0 TRLR',
    ].join('\n'));

    const place = records.find((record) => record.recordType === 'Place');
    const birth = records.find((record) => record.recordType === 'PersonEvent');

    expect(place?.fields).toMatchObject({
      placeName: { value: 'Salem, Essex, Massachusetts, USA' },
      cached_normallocationString: { value: 'Salem, Essex, Massachusetts, USA' },
      place: { value: 'Salem' },
      county: { value: 'Essex' },
      state: { value: 'Massachusetts' },
      country: { value: 'USA' },
    });
    expect(birth?.fields?.placeName?.value).toBe('Salem, Essex, Massachusetts, USA');
    expect(birth?.fields?.place?.value).toBe(`${place.recordName}---Place`);
  });

  it('handles Gramps GEDCOM fixtures for inline notes, inline sources, and custom event tags', () => {
    const records = parseGedcom([
      '0 HEAD',
      '1 SOUR RootsMagic',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Living /Tester/',
      '1 NOTE @N0@',
      '1 SOUR Inline Source 1',
      '1 _ELEC Mayor',
      '2 TYPE Small town',
      '2 DATE 1980',
      '2 PLAC Littletown, Smallcounty, Ohio, USA',
      '0 @N0@ NOTE',
      '1 CONC XREF N0',
      '0 TRLR',
    ].join('\n'));

    const note = records.find((record) => record.recordType === 'Note');
    const inlineSource = records.find((record) => record.recordType === 'Source' && record.fields?.title?.value === 'Inline Source 1');
    const sourceRelation = records.find((record) => record.recordType === 'SourceRelation');
    const customEvent = records.find((record) => record.recordType === 'PersonEvent' && record.fields?.conclusionType?.value === 'SmallTown');

    expect(note?.fields?.text?.value).toBe('XREF N0');
    expect(sourceRelation?.fields?.source?.value).toBe(`${inlineSource.recordName}---Source`);
    expect(customEvent?.fields).toMatchObject({
      date: { value: '1980' },
      description: { value: 'Mayor' },
      placeName: { value: 'Littletown, Smallcounty, Ohio, USA' },
    });
  });

  it('imports Gramps/FTM family custom events and child relationship metadata', () => {
    const records = parseGedcom([
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME Alex /Doe/',
      '0 @I2@ INDI',
      '1 NAME Blair /Doe/',
      '0 @I3@ INDI',
      '1 NAME Casey /Doe/',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 CHIL @I3@',
      '2 _FREL Natural',
      '2 _MREL Adopted',
      '1 _SEPR',
      '2 DATE 1980',
      '2 PLAC Cuyahoga, Ohio, USA',
      '0 TRLR',
    ].join('\n'));

    const relation = records.find((record) => record.recordType === 'ChildRelation');
    const separation = records.find((record) => record.recordType === 'FamilyEvent' && record.fields?.conclusionType?.value === 'Separation');

    expect(relation?.fields).toMatchObject({
      fatherRelationType: { value: 'Natural' },
      motherRelationType: { value: 'Adopted' },
    });
    expect(separation?.fields).toMatchObject({
      date: { value: '1980' },
      placeName: { value: 'Cuyahoga, Ohio, USA' },
    });
  });
});

describe('decodeGedcomBytes', () => {
  it('uses the CHAR tag to decode Windows-1252 GEDCOM text', () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('0 HEAD\n1 CHAR ANSI\n0 @I1@ INDI\n1 NAME Andr'),
      0xe9,
      ...new TextEncoder().encode(' /Doe/\n0 TRLR\n'),
    ]);

    expect(decodeGedcomBytes(bytes, 'legacy.ged')).toContain('André /Doe/');
  });
});
