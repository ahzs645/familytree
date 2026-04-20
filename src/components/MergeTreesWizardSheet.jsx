import React, { useState } from 'react';
import { planMerge, mergeBackupJSONWithResolutions, CONFLICT_RESOLUTION } from '../lib/mergeImport.js';
import { MergeConflictSheet } from './MergeConflictSheet.jsx';

/**
 * MergeTreesWizardSheet — multi-step wizard for merging two family trees.
 *
 * Mac reference: MergeSheet.nib + MergeSelectFileURLView.nib + MergeSelectMergeModeView.nib
 * + MergeProgressView.nib + MergeFinishedView.nib + MergeFailedView.nib.
 *
 * Steps: pick-file → pick-mode → plan-review → conflicts (if any) → progress → done.
 */
const STEPS = ['file', 'mode', 'plan', 'conflicts', 'progress', 'done'];

const MERGE_MODES = [
  { id: 'incoming-wins', label: 'Incoming wins', description: 'Incoming records overwrite conflicts.' },
  { id: 'existing-wins', label: 'Existing wins', description: 'Keep existing data; only add new records.' },
  { id: 'keep-both', label: 'Keep both (rename)', description: 'Rename conflicting incoming records.' },
  { id: 'manual', label: 'Manual per-record', description: 'Resolve each conflict by hand.' },
];

export function MergeTreesWizardSheet({ onClose, onComplete }) {
  const [step, setStep] = useState('file');
  const [file, setFile] = useState(null);
  const [json, setJson] = useState(null);
  const [mode, setMode] = useState('incoming-wins');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [resolutions, setResolutions] = useState({});
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState('');

  const onPickFile = async (selected) => {
    setError('');
    if (!selected) return;
    try {
      const text = await selected.text();
      const parsed = JSON.parse(text);
      setFile(selected);
      setJson(parsed);
      setStep('mode');
    } catch (err) {
      setError(`Failed to read ${selected.name}: ${err.message}`);
    }
  };

  const goToPlan = async () => {
    setError('');
    setProgress('Analyzing merge…');
    try {
      const nextPlan = await planMerge(json);
      setPlan(nextPlan);
      setStep('plan');
    } catch (err) {
      setError(err.message);
      setStep('mode');
    } finally {
      setProgress('');
    }
  };

  const resolutionsForMode = () => {
    if (!plan) return {};
    const out = {};
    for (const conflict of plan.conflicts) {
      switch (mode) {
        case 'incoming-wins': out[conflict.recordName] = CONFLICT_RESOLUTION.USE_INCOMING; break;
        case 'existing-wins': out[conflict.recordName] = CONFLICT_RESOLUTION.KEEP_EXISTING; break;
        case 'keep-both': out[conflict.recordName] = CONFLICT_RESOLUTION.RENAME_INCOMING; break;
        default: break;
      }
    }
    return out;
  };

  const commitMerge = async (overrideResolutions) => {
    setStep('progress');
    setProgress('Applying merge…');
    try {
      const merged = await mergeBackupJSONWithResolutions(json, overrideResolutions || resolutionsForMode(), {});
      setResult(merged);
      setStep('done');
      onComplete?.(merged);
    } catch (err) {
      setError(err.message);
      setStep('plan');
    } finally {
      setProgress('');
    }
  };

  const onManualConfirm = (nextResolutions) => {
    setResolutions(nextResolutions);
    commitMerge(nextResolutions);
  };

  const proceedFromPlan = () => {
    if (!plan) return;
    if (plan.conflicts.length && mode === 'manual') {
      setStep('conflicts');
      return;
    }
    commitMerge();
  };

  if (step === 'conflicts' && plan) {
    return (
      <MergeConflictSheet
        conflicts={plan.conflicts}
        initialResolutions={resolutions}
        onCancel={() => setStep('plan')}
        onConfirm={onManualConfirm}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Merge trees</h2>
          <div className="text-xs text-muted-foreground">Step {STEPS.indexOf(step) + 1} of {STEPS.length}</div>
        </header>
        <div className="p-4 space-y-3 text-xs">
          {error && <div className="text-destructive">{error}</div>}
          {step === 'file' && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Choose a CloudTreeWeb backup .json file to merge into the current tree.</p>
              <input type="file" accept="application/json,.json" onChange={(e) => onPickFile(e.target.files?.[0])} className="w-full" />
              {file && <div>Selected: <span className="font-mono">{file.name}</span></div>}
            </div>
          )}
          {step === 'mode' && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Choose how to resolve conflicts during merge.</p>
              {MERGE_MODES.map((m) => (
                <label key={m.id} className="flex items-start gap-2 p-2 rounded-md border border-border hover:bg-accent cursor-pointer">
                  <input type="radio" checked={mode === m.id} onChange={() => setMode(m.id)} className="mt-0.5" />
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-muted-foreground">{m.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {step === 'plan' && plan && (
            <div className="space-y-1">
              <div>New records: <span className="font-semibold">{plan.newRecords.length}</span></div>
              <div>Conflicts: <span className="font-semibold">{plan.conflicts.length}</span></div>
              <div>Asset collisions: <span className="font-semibold">{plan.assetCollisions.length}</span></div>
              <div className="text-muted-foreground mt-2">Mode: <span className="font-semibold">{MERGE_MODES.find((m) => m.id === mode)?.label}</span></div>
              {mode === 'manual' && plan.conflicts.length > 0 && (
                <div className="text-muted-foreground">You will be prompted to resolve each conflict individually.</div>
              )}
            </div>
          )}
          {step === 'progress' && <div className="text-muted-foreground">{progress || 'Working…'}</div>}
          {step === 'done' && result && (
            <div className="space-y-1">
              <div className="text-emerald-500 font-semibold">Merge complete.</div>
              <div>Records saved: {result.savedRecords ?? result.records?.length ?? 0}</div>
              <div>Assets saved: {result.savedAssets ?? result.assets?.length ?? 0}</div>
            </div>
          )}
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center justify-between">
          <button type="button" onClick={onClose} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          <div className="flex items-center gap-2">
            {step === 'mode' && <button onClick={goToPlan} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">Analyze</button>}
            {step === 'plan' && <button onClick={proceedFromPlan} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">Apply merge</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default MergeTreesWizardSheet;
