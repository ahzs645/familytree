import { describe, expect, it } from 'vitest';
import {
  CHART_DOCUMENT_SCHEMA_VERSION,
  normalizeChartDocument,
  migrateChartDocument,
  createDefaultBuilderConfig,
  createDefaultCompositorConfig,
  createDefaultPageSetup,
  createDefaultExportSettings,
} from './chartDocumentSchema.js';

describe('chart document schema V2', () => {
  describe('schemaVersion', () => {
    it('stamps schemaVersion 2 on empty input', () => {
      const doc = normalizeChartDocument({});
      expect(doc.schemaVersion).toBe(CHART_DOCUMENT_SCHEMA_VERSION);
      expect(doc.schemaVersion).toBe(2);
    });

    it('overwrites an older schemaVersion on normalize', () => {
      const doc = normalizeChartDocument({ schemaVersion: 1 });
      expect(doc.schemaVersion).toBe(2);
    });

    it('handles null/undefined input without throwing', () => {
      expect(() => normalizeChartDocument()).not.toThrow();
      expect(() => normalizeChartDocument(null)).not.toThrow();
      expect(normalizeChartDocument(null).schemaVersion).toBe(2);
    });
  });

  describe('roots', () => {
    it('reads roots from new roots block', () => {
      const doc = normalizeChartDocument({
        roots: { primaryPersonId: 'p1', secondaryPersonId: 'p2' },
      });
      expect(doc.roots.primaryPersonId).toBe('p1');
      expect(doc.roots.secondaryPersonId).toBe('p2');
    });

    it('falls back to legacy rootId/secondId', () => {
      const doc = normalizeChartDocument({ rootId: 'legacy1', secondId: 'legacy2' });
      expect(doc.roots.primaryPersonId).toBe('legacy1');
      expect(doc.roots.secondaryPersonId).toBe('legacy2');
    });

    it('prefers roots block over legacy fields', () => {
      const doc = normalizeChartDocument({
        rootId: 'legacy',
        roots: { primaryPersonId: 'new' },
      });
      expect(doc.roots.primaryPersonId).toBe('new');
    });

    it('mirrors roots to legacy compatibility fields', () => {
      const doc = normalizeChartDocument({
        roots: { primaryPersonId: 'p1', secondaryPersonId: 'p2' },
      });
      expect(doc.rootId).toBe('p1');
      expect(doc.secondId).toBe('p2');
    });

    it('defaults missing roots to null', () => {
      const doc = normalizeChartDocument({});
      expect(doc.roots.primaryPersonId).toBeNull();
      expect(doc.roots.secondaryPersonId).toBeNull();
    });
  });

  describe('builderConfig', () => {
    it('provides all per-chart option slots', () => {
      const config = createDefaultBuilderConfig('ancestor', {});
      for (const key of [
        'ancestor',
        'descendant',
        'tree',
        'fan',
        'hourglass',
        'doubleAncestor',
        'relationship',
        'genogram',
        'sociogram',
        'timeline',
        'distribution',
        'statistics',
        'virtual',
      ]) {
        expect(config[key]).toBeDefined();
        expect(typeof config[key]).toBe('object');
      }
    });

    it('sets common.privacyMode default to public', () => {
      const doc = normalizeChartDocument({});
      expect(doc.builderConfig.common.privacyMode).toBe('public');
    });

    it('clamps generations to [2, 12] with default 5', () => {
      expect(createDefaultBuilderConfig('ancestor', {}).common.generations).toBe(5);
      expect(createDefaultBuilderConfig('ancestor', { generations: 100 }).common.generations).toBe(12);
      expect(createDefaultBuilderConfig('ancestor', { generations: 0 }).common.generations).toBe(2);
      expect(createDefaultBuilderConfig('ancestor', { generations: 'junk' }).common.generations).toBe(5);
    });

    it('reads legacy generations field at root', () => {
      const doc = normalizeChartDocument({ generations: 7 });
      expect(doc.builderConfig.common.generations).toBe(7);
    });

    it('initializes relationship defaults', () => {
      const doc = normalizeChartDocument({});
      expect(doc.builderConfig.relationship.bloodlineOnly).toBe(false);
      expect(doc.builderConfig.relationship.selectedPathId).toBeNull();
      expect(doc.builderConfig.relationship.maxDepth).toBe(12);
      expect(doc.builderConfig.relationship.maxPaths).toBe(12);
    });

    it('preserves user-provided relationship options', () => {
      const doc = normalizeChartDocument({
        builderConfig: {
          relationship: { bloodlineOnly: true, maxDepth: 5 },
        },
      });
      expect(doc.builderConfig.relationship.bloodlineOnly).toBe(true);
      expect(doc.builderConfig.relationship.maxDepth).toBe(5);
    });

    it('initializes virtual defaults and clamps spacing', () => {
      const doc = normalizeChartDocument({});
      expect(doc.builderConfig.virtual.source).toBe('descendant');
      expect(doc.builderConfig.virtual.orientation).toBe('vertical');
      expect(doc.builderConfig.virtual.hSpacing).toBe(24);
      expect(doc.builderConfig.virtual.vSpacing).toBe(110);
    });

    it('clamps virtual spacing out of range', () => {
      const doc = normalizeChartDocument({
        virtual: { hSpacing: 9999, vSpacing: 1 },
      });
      expect(doc.builderConfig.virtual.hSpacing).toBe(200);
      expect(doc.builderConfig.virtual.vSpacing).toBe(50);
    });

    it('normalizes virtual source enum', () => {
      const docA = normalizeChartDocument({ virtual: { source: 'ancestor' } });
      const docB = normalizeChartDocument({ virtual: { source: 'other' } });
      expect(docA.builderConfig.virtual.source).toBe('ancestor');
      expect(docB.builderConfig.virtual.source).toBe('descendant');
    });

    it('tracks activeChart based on chartType', () => {
      const doc = normalizeChartDocument({ chartType: 'fan' });
      expect(doc.builderConfig.activeChart).toBe('fan');
    });
  });

  describe('compositorConfig', () => {
    it('provides all compositor fields with defaults', () => {
      const cfg = createDefaultCompositorConfig({});
      expect(cfg.themeId).toBe('auto');
      expect(cfg.layoutMode).toBe('auto');
      expect(cfg.objectStyles).toEqual({});
      expect(cfg.connectionStyles).toEqual({});
      expect(cfg.overlays).toEqual([]);
      expect(cfg.selectedObjectIds).toEqual([]);
    });

    it('falls back to legacy themeId and overlays', () => {
      const cfg = createDefaultCompositorConfig({
        themeId: 'dark',
        overlays: [{ id: 'a', type: 'text' }],
      });
      expect(cfg.themeId).toBe('dark');
      expect(cfg.overlays).toHaveLength(1);
    });

    it('prefers compositorConfig block over legacy', () => {
      const cfg = createDefaultCompositorConfig({
        themeId: 'legacy',
        compositorConfig: { themeId: 'preferred' },
      });
      expect(cfg.themeId).toBe('preferred');
    });

    it('mirrors themeId into top-level legacy field', () => {
      const doc = normalizeChartDocument({ compositorConfig: { themeId: 'dark' } });
      expect(doc.themeId).toBe('dark');
    });
  });

  describe('pageSetup', () => {
    it('provides all pageSetup fields', () => {
      const page = createDefaultPageSetup({});
      expect(page.paperSize).toBe('letter');
      expect(page.orientation).toBe('landscape');
      expect(page.width).toBeNull();
      expect(page.height).toBeNull();
      expect(page.margins).toEqual({ top: 36, right: 36, bottom: 36, left: 36 });
      expect(page.overlap).toBe(0);
      expect(page.printPageNumbers).toBe(false);
      expect(page.cutMarks).toBe(false);
      expect(page.omitEmptyPages).toBe(true);
      expect(page.backgroundColor).toBe('');
      expect(page.title).toBe('');
      expect(page.note).toBe('');
    });

    it('reads legacy page fields', () => {
      const page = createDefaultPageSetup({
        page: { size: 'a4', orientation: 'portrait', backgroundColor: '#fff', title: 'T', note: 'N' },
      });
      expect(page.paperSize).toBe('a4');
      expect(page.orientation).toBe('portrait');
      expect(page.backgroundColor).toBe('#fff');
      expect(page.title).toBe('T');
      expect(page.note).toBe('N');
    });

    it('preserves custom width/height', () => {
      const page = createDefaultPageSetup({
        pageSetup: { width: 800, height: 600 },
      });
      expect(page.width).toBe(800);
      expect(page.height).toBe(600);
    });

    it('preserves custom margins', () => {
      const page = createDefaultPageSetup({
        pageSetup: { margins: { top: 10, right: 20, bottom: 30, left: 40 } },
      });
      expect(page.margins).toEqual({ top: 10, right: 20, bottom: 30, left: 40 });
    });

    it('preserves print flags', () => {
      const page = createDefaultPageSetup({
        pageSetup: { printPageNumbers: true, cutMarks: true, omitEmptyPages: false, overlap: 12 },
      });
      expect(page.printPageNumbers).toBe(true);
      expect(page.cutMarks).toBe(true);
      expect(page.omitEmptyPages).toBe(false);
      expect(page.overlap).toBe(12);
    });

    it('mirrors page legacy shape', () => {
      const doc = normalizeChartDocument({
        pageSetup: { title: 'Hello', paperSize: 'a3', orientation: 'portrait' },
      });
      expect(doc.page.title).toBe('Hello');
      expect(doc.page.size).toBe('a3');
      expect(doc.page.orientation).toBe('portrait');
    });
  });

  describe('exportSettings', () => {
    it('provides all exportSettings fields', () => {
      const settings = createDefaultExportSettings({});
      expect(settings.format).toBe('png');
      expect(settings.scale).toBe(1);
      expect(settings.includeBackground).toBe(true);
      expect(settings.jpegQuality).toBe(0.92);
      expect(settings.fileNameTemplate).toBe('{title}-{date}');
    });

    it('clamps scale to [0.25, 4]', () => {
      expect(createDefaultExportSettings({ exportSettings: { scale: 10 } }).scale).toBe(4);
      expect(createDefaultExportSettings({ exportSettings: { scale: 0 } }).scale).toBe(0.25);
    });

    it('clamps jpegQuality to [0.1, 1]', () => {
      expect(createDefaultExportSettings({ exportSettings: { jpegQuality: 2 } }).jpegQuality).toBe(1);
      expect(createDefaultExportSettings({ exportSettings: { jpegQuality: 0 } }).jpegQuality).toBe(0.1);
    });

    it('preserves user format and template', () => {
      const settings = createDefaultExportSettings({
        exportSettings: { format: 'pdf', fileNameTemplate: '{name}' },
      });
      expect(settings.format).toBe('pdf');
      expect(settings.fileNameTemplate).toBe('{name}');
    });

    it('respects explicit includeBackground=false', () => {
      const settings = createDefaultExportSettings({
        exportSettings: { includeBackground: false },
      });
      expect(settings.includeBackground).toBe(false);
    });
  });

  describe('importedMac', () => {
    it('is omitted when no metadata provided', () => {
      const doc = normalizeChartDocument({});
      expect(doc.importedMac).toBeUndefined();
    });

    it('preserves Mac metadata from importedMac block', () => {
      const doc = normalizeChartDocument({
        importedMac: {
          sourceRecordName: 'rec-1',
          sourceRecordType: 'SavedChart',
          sourceStatus: 'decoded',
          detectedChartClass: 'AncestorChart',
          decodedPayloadSummary: { foo: 'bar' },
          unsupportedObjectCount: 3,
        },
      });
      expect(doc.importedMac.sourceRecordName).toBe('rec-1');
      expect(doc.importedMac.sourceRecordType).toBe('SavedChart');
      expect(doc.importedMac.sourceStatus).toBe('decoded');
      expect(doc.importedMac.detectedChartClass).toBe('AncestorChart');
      expect(doc.importedMac.decodedPayloadSummary).toEqual({ foo: 'bar' });
      expect(doc.importedMac.unsupportedObjectCount).toBe(3);
    });

    it('reads metadata block as a legacy fallback', () => {
      const doc = normalizeChartDocument({
        metadata: { sourceRecordName: 'rec-x', sourceRecordType: 'SavedView' },
      });
      expect(doc.importedMac.sourceRecordName).toBe('rec-x');
      expect(doc.importedMac.sourceRecordType).toBe('SavedView');
    });

    it('defaults unsupportedObjectCount to 0', () => {
      const doc = normalizeChartDocument({
        importedMac: { sourceRecordName: 'r' },
      });
      expect(doc.importedMac.unsupportedObjectCount).toBe(0);
    });
  });

  describe('migration from shallow legacy docs', () => {
    it('migrates a pre-V2 shallow document', () => {
      const legacy = {
        id: 'chart-1',
        name: 'My Tree',
        chartType: 'descendant',
        rootId: 'root-1',
        secondId: 'root-2',
        generations: 4,
        themeId: 'light',
        virtual: { source: 'ancestor', hSpacing: 40 },
        page: { size: 'a4', orientation: 'portrait', title: 'Hello' },
        overlays: [{ id: 'o1', type: 'text', text: 'Hi' }],
      };
      const doc = migrateChartDocument(legacy);
      expect(doc.schemaVersion).toBe(2);
      expect(doc.id).toBe('chart-1');
      expect(doc.name).toBe('My Tree');
      expect(doc.chartType).toBe('descendant');
      expect(doc.roots.primaryPersonId).toBe('root-1');
      expect(doc.roots.secondaryPersonId).toBe('root-2');
      expect(doc.builderConfig.common.generations).toBe(4);
      expect(doc.builderConfig.virtual.source).toBe('ancestor');
      expect(doc.builderConfig.virtual.hSpacing).toBe(40);
      expect(doc.compositorConfig.themeId).toBe('light');
      expect(doc.compositorConfig.overlays).toHaveLength(1);
      expect(doc.pageSetup.paperSize).toBe('a4');
      expect(doc.pageSetup.orientation).toBe('portrait');
      expect(doc.pageSetup.title).toBe('Hello');
    });

    it('preserves legacy compatibility fields alongside V2 structure', () => {
      const doc = migrateChartDocument({ rootId: 'p1', generations: 6, themeId: 'dark' });
      expect(doc.rootId).toBe('p1');
      expect(doc.generations).toBe(6);
      expect(doc.themeId).toBe('dark');
      expect(doc.virtual.source).toBeDefined();
      expect(doc.page.size).toBeDefined();
    });

    it('is idempotent', () => {
      const first = normalizeChartDocument({ rootId: 'p1', generations: 4 });
      const second = normalizeChartDocument(first);
      expect(second.schemaVersion).toBe(2);
      expect(second.roots.primaryPersonId).toBe('p1');
      expect(second.builderConfig.common.generations).toBe(4);
    });

    it('provides a default name when missing', () => {
      expect(normalizeChartDocument({}).name).toBe('Untitled Chart');
      expect(normalizeChartDocument({ title: 'From Title' }).name).toBe('From Title');
    });

    it('defaults chartType to ancestor when unspecified', () => {
      expect(normalizeChartDocument({}).chartType).toBe('ancestor');
    });
  });
});
