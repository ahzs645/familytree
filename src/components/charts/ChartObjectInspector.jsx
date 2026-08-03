/**
 * Property inspector for the currently selected chart overlay(s).
 *
 * Mac reference: the chart pane's right-hand Object Inspector.
 * Supports single selection (selectedOverlayId) and multi-selection
 * (selectedOverlayIds) with native-style messaging for:
 *   - no editable properties (fallback)
 *   - mixed-type selection ("multiple objects of different kinds")
 *   - uniform multi-selection (shared editable fields only)
 */
import React from 'react';
import { Select } from '../ui/Select.jsx';
import { Input } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

const ROW_CLASSES = 'block mb-2';
const LABEL_CLASSES = 'mb-1 text-xs text-muted-foreground';
const NOTICE_CLASSES = 'm-2 rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground';

function NumberField({ value, onChange, label: labelText, min, step = 1 }) {
  return (
    <label className={ROW_CLASSES}>
      <div className={LABEL_CLASSES}>{labelText}</div>
      <Input
        compact
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TextField({ value, onChange, label: labelText, type = 'text', placeholder }) {
  return (
    <label className={ROW_CLASSES}>
      <div className={LABEL_CLASSES}>{labelText}</div>
      <Input
        compact
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ColorField({ value, onChange, label: labelText }) {
  return (
    <label className={ROW_CLASSES}>
      <div className={LABEL_CLASSES}>{labelText}</div>
      <div className="flex gap-1.5">
        <input
          type="color"
          aria-label={labelText}
          value={value || '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-9 rounded-md border border-border bg-transparent p-0"
        />
        <Input
          compact
          type="text"
          aria-label={labelText}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1"
        />
      </div>
    </label>
  );
}

function SelectField({ value, onChange, label: labelText, options }) {
  return (
    <label className={ROW_CLASSES}>
      <div className={LABEL_CLASSES}>{labelText}</div>
      <Select
        ariaLabel={labelText}
        value={value ?? ''}
        onChange={onChange}
        options={options}
        triggerClassName="h-8 ps-2 text-xs"
      />
    </label>
  );
}

function multiValue(items, key) {
  const first = items[0]?.[key];
  return items.every((item) => item[key] === first) ? first : null;
}

function TextFields({ subject, patch, includeGeometry = true, t }) {
  return (
    <>
      {subject.text !== undefined && <TextField label={t('charts.objectInspector.text')} value={subject.text} onChange={(value) => patch({ text: value })} />}
      {includeGeometry && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('charts.objectInspector.x')} value={subject.x} onChange={(value) => patch({ x: value })} />
          <NumberField label={t('charts.objectInspector.y')} value={subject.y} onChange={(value) => patch({ y: value })} />
        </div>
      )}
      <NumberField label={t('charts.objectInspector.fontSize')} value={subject.fontSize} min={6} onChange={(value) => patch({ fontSize: Math.max(6, value) })} />
      <SelectField
        label={t('charts.objectInspector.weight')}
        value={subject.fontWeight || 'normal'}
        onChange={(value) => patch({ fontWeight: value })}
        options={[{ value: 'normal', label: t('charts.objectInspector.normal') }, { value: 'bold', label: t('charts.objectInspector.bold') }]}
      />
      <ColorField label={t('charts.objectInspector.color')} value={subject.color} onChange={(value) => patch({ color: value })} />
      <NumberField label={t('charts.objectInspector.opacity')} value={subject.opacity ?? 1} step={0.1} min={0} onChange={(value) => patch({ opacity: Math.min(1, Math.max(0, value)) })} />
    </>
  );
}

function LineFields({ subject, patch, includeGeometry = true, t }) {
  return (
    <>
      {includeGeometry && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('charts.objectInspector.x1')} value={subject.x1} onChange={(value) => patch({ x1: value })} />
          <NumberField label={t('charts.objectInspector.y1')} value={subject.y1} onChange={(value) => patch({ y1: value })} />
          <NumberField label={t('charts.objectInspector.x2')} value={subject.x2} onChange={(value) => patch({ x2: value })} />
          <NumberField label={t('charts.objectInspector.y2')} value={subject.y2} onChange={(value) => patch({ y2: value })} />
        </div>
      )}
      <NumberField label={t('charts.objectInspector.lineWidth')} value={subject.strokeWidth} min={0.5} step={0.5} onChange={(value) => patch({ strokeWidth: Math.max(0.5, value) })} />
      <SelectField
        label={t('charts.objectInspector.strokeStyle')}
        value={subject.strokeDash || 'solid'}
        onChange={(value) => patch({ strokeDash: value })}
        options={[
          { value: 'solid', label: t('charts.objectInspector.solid') },
          { value: 'dashed', label: t('charts.objectInspector.dashed') },
          { value: 'dotted', label: t('charts.objectInspector.dotted') },
        ]}
      />
      <ColorField label={t('charts.objectInspector.color')} value={subject.color} onChange={(value) => patch({ color: value })} />
      <NumberField label={t('charts.objectInspector.opacity')} value={subject.opacity ?? 1} step={0.1} min={0} onChange={(value) => patch({ opacity: Math.min(1, Math.max(0, value)) })} />
    </>
  );
}

function ImageFields({ subject, patch, includeGeometry = true, t }) {
  return (
    <>
      {subject.href !== undefined && <TextField label={t('charts.objectInspector.imageUrl')} value={subject.href} onChange={(value) => patch({ href: value })} placeholder={t('charts.objectInspector.imageUrlPlaceholder')} />}
      {includeGeometry && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('charts.objectInspector.x')} value={subject.x} onChange={(value) => patch({ x: value })} />
          <NumberField label={t('charts.objectInspector.y')} value={subject.y} onChange={(value) => patch({ y: value })} />
          <NumberField label={t('charts.objectInspector.width')} value={subject.width} min={4} onChange={(value) => patch({ width: Math.max(4, value) })} />
          <NumberField label={t('charts.objectInspector.height')} value={subject.height} min={4} onChange={(value) => patch({ height: Math.max(4, value) })} />
        </div>
      )}
      <NumberField label={t('charts.objectInspector.opacity')} value={subject.opacity ?? 1} step={0.1} min={0} onChange={(value) => patch({ opacity: Math.min(1, Math.max(0, value)) })} />
    </>
  );
}

function PersonFields({ style, patch, reset, t }) {
  return (
    <>
      <ColorField label={t('charts.objectInspector.fillColor')} value={style.fill || '#ffffff'} onChange={(fill) => patch({ fill })} />
      <ColorField label={t('charts.objectInspector.borderColor')} value={style.borderColor || '#444444'} onChange={(borderColor) => patch({ borderColor })} />
      <ColorField label={t('charts.objectInspector.textColor')} value={style.textColor || '#222222'} onChange={(textColor) => patch({ textColor })} />
      <NumberField label={t('charts.objectInspector.fontScale')} value={style.fontScale ?? 1} min={0.5} step={0.1} onChange={(fontScale) => patch({ fontScale: Math.max(0.5, Math.min(2, fontScale)) })} />
      <SelectField
        label={t('charts.objectInspector.photo')}
        value={style.showPhoto == null ? 'default' : style.showPhoto ? 'show' : 'hide'}
        onChange={(value) => patch({ showPhoto: value === 'default' ? null : value === 'show' })}
        options={[
          { value: 'default', label: t('charts.objectInspector.themeDefault') },
          { value: 'show', label: t('charts.objectInspector.show') },
          { value: 'hide', label: t('charts.objectInspector.hide') },
        ]}
      />
      <Button onClick={reset}>{t('charts.objectInspector.resetOverrides')}</Button>
    </>
  );
}

function ConnectionFields({ style, patch, reset, t }) {
  return (
    <>
      <NumberField label={t('charts.objectInspector.lineWidth')} value={style.lineWidth ?? 1.5} min={0.5} step={0.5} onChange={(lineWidth) => patch({ lineWidth: Math.max(0.5, lineWidth) })} />
      <ColorField label={t('charts.objectInspector.color')} value={style.color || '#777777'} onChange={(color) => patch({ color })} />
      <SelectField
        label={t('charts.objectInspector.cornerStyle')}
        value={style.cornerStyle || 'rounded'}
        onChange={(cornerStyle) => patch({ cornerStyle })}
        options={[
          { value: 'rounded', label: t('charts.objectInspector.rounded') },
          { value: 'sharp', label: t('charts.objectInspector.sharp') },
          { value: 'beveled', label: t('charts.objectInspector.beveled') },
        ]}
      />
      <Button onClick={reset}>{t('charts.objectInspector.resetOverrides')}</Button>
    </>
  );
}

export function ChartObjectInspector({
  overlays = [],
  selectedOverlayId,
  selectedOverlayIds,
  selectedObject,
  objectStyles = {},
  connectionStyles = {},
  onUpdateOverlay,
  onUpdateObjectStyle,
  onUpdateConnectionStyle,
}) {
  const { t } = useTranslation();

  if (selectedObject?.kind === 'person') {
    const style = objectStyles[selectedObject.id] || {};
    return (
      <div className="p-3 text-xs">
        <div className="mb-2 text-xs tracking-wide text-muted-foreground">
          {t('charts.objectInspector.titlePerson', { name: selectedObject.label || selectedObject.id })}
        </div>
        <PersonFields
          style={style}
          patch={(changes) => onUpdateObjectStyle?.(selectedObject.id, changes)}
          reset={() => onUpdateObjectStyle?.(selectedObject.id, {}, { replace: true })}
          t={t}
        />
      </div>
    );
  }

  if (selectedObject?.kind === 'connection') {
    const style = connectionStyles[selectedObject.id] || {};
    return (
      <div className="p-3 text-xs">
        <div className="mb-2 text-xs tracking-wide text-muted-foreground">
          {t('charts.objectInspector.titleConnection')}
        </div>
        <ConnectionFields
          style={style}
          patch={(changes) => onUpdateConnectionStyle?.(selectedObject.id, changes)}
          reset={() => onUpdateConnectionStyle?.(selectedObject.id, {}, { replace: true })}
          t={t}
        />
      </div>
    );
  }

  const ids = Array.isArray(selectedOverlayIds) && selectedOverlayIds.length
    ? selectedOverlayIds
    : (selectedOverlayId ? [selectedOverlayId] : []);
  const selection = overlays.filter((overlay) => ids.includes(overlay?.id));

  if (!selection.length) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        {t('charts.objectInspector.selectPrompt')}
      </div>
    );
  }

  const types = new Set(selection.map((item) => item.type));
  if (types.size > 1) {
    return (
      <div className={NOTICE_CLASSES}>
        {t('charts.objectInspector.mixedSelection')}
      </div>
    );
  }

  const type = [...types][0];
  const isMulti = selection.length > 1;
  const subject = isMulti
    ? {
        type,
        text: multiValue(selection, 'text'),
        fontSize: multiValue(selection, 'fontSize'),
        fontWeight: multiValue(selection, 'fontWeight'),
        color: multiValue(selection, 'color'),
        opacity: multiValue(selection, 'opacity'),
        strokeWidth: multiValue(selection, 'strokeWidth'),
        strokeDash: multiValue(selection, 'strokeDash'),
        href: multiValue(selection, 'href'),
      }
    : selection[0];

  const patch = (changes) => {
    if (!onUpdateOverlay) return;
    selection.forEach((item) => onUpdateOverlay(item.id, { ...item, ...changes }));
  };

  if (!['text', 'line', 'image'].includes(type)) {
    return (
      <div className={NOTICE_CLASSES}>
        {t('charts.objectInspector.noProperties')}
      </div>
    );
  }

  return (
    <div className="p-3 text-xs">
      <div className="mb-2 text-xs tracking-wide text-muted-foreground">
        {t('charts.objectInspector.titleOverlay', { type: (type || '').toUpperCase() })}
        {isMulti ? ` ${t('charts.objectInspector.selectedCount', { count: selection.length })}` : ''}
      </div>
      {type === 'text' && <TextFields subject={subject} patch={patch} includeGeometry={!isMulti} t={t} />}
      {type === 'line' && <LineFields subject={subject} patch={patch} includeGeometry={!isMulti} t={t} />}
      {type === 'image' && <ImageFields subject={subject} patch={patch} includeGeometry={!isMulti} t={t} />}
    </div>
  );
}

export default ChartObjectInspector;
