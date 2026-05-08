/**
 * Editor row for an Islamic milk-kinship (الرضاعة) record between the
 * current person and a related party. The "this person is" select swaps
 * which other-party fields are required (nursing mother, milk father, or
 * breastfed child).
 */
import React from 'react';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { Field, RemoveBtn, inputClass } from './uiPrimitives.jsx';

export function emptyMilkKinship(currentPersonId) {
  return {
    role: 'child',
    childId: currentPersonId,
    nursingMotherId: '',
    milkFatherId: '',
    startDate: '',
    endDate: '',
    notes: '',
    isActive: true,
  };
}

export function MilkKinshipEditor({ item, persons, currentPersonId, onChange, onRemove }) {
  const updateRole = (role) => {
    const next = { ...item, role };
    if (item.role === 'child' && next.childId === currentPersonId) next.childId = '';
    if (item.role === 'nursingMother' && next.nursingMotherId === currentPersonId) next.nursingMotherId = '';
    if (item.role === 'milkFather' && next.milkFatherId === currentPersonId) next.milkFatherId = '';
    if (role === 'child') next.childId = currentPersonId;
    if (role === 'nursingMother') next.nursingMotherId = currentPersonId;
    if (role === 'milkFather') next.milkFatherId = currentPersonId;
    onChange(next);
  };
  const role = item.role || 'child';
  const showMother = role !== 'nursingMother';
  const showFather = role !== 'milkFather';
  const showChild = role !== 'child';
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3">
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2 items-end">
        <Field label="This person is">
          <select value={role} onChange={(event) => updateRole(event.target.value)} className={inputClass()}>
            <option value="child">Breastfed child</option>
            <option value="nursingMother">Nursing mother</option>
            <option value="milkFather">Milk father</option>
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {showMother ? (
            <Field label="Nursing mother">
              <PersonPicker persons={persons.filter((p) => p.recordName !== currentPersonId)} value={item.nursingMotherId || ''} onChange={(value) => onChange({ ...item, nursingMotherId: value })} />
            </Field>
          ) : null}
          {showFather ? (
            <Field label="Milk father">
              <PersonPicker persons={persons.filter((p) => p.recordName !== currentPersonId)} value={item.milkFatherId || ''} onChange={(value) => onChange({ ...item, milkFatherId: value })} />
            </Field>
          ) : null}
          {showChild ? (
            <Field label="Breastfed child">
              <PersonPicker persons={persons.filter((p) => p.recordName !== currentPersonId)} value={item.childId || ''} onChange={(value) => onChange({ ...item, childId: value })} />
            </Field>
          ) : null}
        </div>
        <RemoveBtn onClick={onRemove} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-2 mt-3">
        <Field label="Start date">
          <input value={item.startDate || ''} onChange={(event) => onChange({ ...item, startDate: event.target.value })} className={inputClass()} />
        </Field>
        <Field label="End date">
          <input value={item.endDate || ''} onChange={(event) => onChange({ ...item, endDate: event.target.value })} className={inputClass()} />
        </Field>
        <Field label="Active">
          <select value={item.isActive === false ? 'no' : 'yes'} onChange={(event) => onChange({ ...item, isActive: event.target.value === 'yes' })} className={inputClass()}>
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <textarea value={item.notes || ''} onChange={(event) => onChange({ ...item, notes: event.target.value })} rows={2} className={inputClass() + ' resize-y'} />
        </Field>
      </div>
    </div>
  );
}
