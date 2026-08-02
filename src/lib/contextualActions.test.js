import { describe, expect, it } from 'vitest';
import { contextualActions } from './contextualActions.js';

describe('contextual editor actions', () => {
  it('creates person-aware chart and workspace deep links', () => {
    const groups = contextualActions({ personId: 'person 1', recordType: 'Person', recordId: 'person 1' });
    const actions = groups.flatMap((group) => group.actions);
    expect(actions.find((action) => action.id === 'ancestorChart')?.href).toBe('/charts?person=person+1&type=ancestor');
    expect(actions.find((action) => action.id === 'interactiveTree')?.href).toBe('/tree?person=person+1');
    expect(actions.find((action) => action.id === 'duplicates')?.href).toContain('recordId=person+1');
    expect(actions.find((action) => action.id === 'webSearch')?.href).toContain('personId=person+1');
  });

  it('scopes family map and duplicate actions to the family record', () => {
    const actions = contextualActions({ personId: 'p1', familyId: 'f1', recordType: 'Family', recordId: 'f1' }).flatMap((group) => group.actions);
    expect(actions.find((action) => action.id === 'map')?.href).toBe('/map?family=f1');
    expect(actions.find((action) => action.id === 'duplicates')?.href).toBe('/duplicates?kind=Family&recordId=f1&auto=1');
  });
});

