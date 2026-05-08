import React, { useMemo } from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { CheckButton, Panel } from '../sharedUI.jsx';
import { APP_FUNCTIONS, groupedFunctions } from '../../../lib/functionCatalog.js';

export default function FunctionsPanel() {
  const { prefs, setPrefs, t } = useSettings();
  const groups = useMemo(() => groupedFunctions(APP_FUNCTIONS.filter((item) => !item.unavailable)), []);
  const toggleList = (listName, route) => {
    setPrefs((current) => {
      const set = new Set(current.functions[listName] || []);
      if (set.has(route)) set.delete(route);
      else set.add(route);
      return {
        ...current,
        functions: {
          ...current.functions,
          [listName]: [...set],
        },
      };
    });
  };

  return (
    <Panel title={t('settingsPage.functions.panel')}>
      <div className="space-y-5">
        {Object.entries(groups).map(([category, items]) => {
          const categoryKey = `categories.${category.toLowerCase()}`;
          const categoryLabel = t(categoryKey);
          return (
            <section key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {categoryLabel === categoryKey ? category : categoryLabel}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((item) => (
                  <div key={item.to} className="rounded-md border border-border bg-card p-3">
                    <div className="text-sm font-medium mb-2">{t(`appFunctions.${item.to}`, { defaultValue: item.label })}</div>
                    <div className="flex flex-wrap gap-2">
                      <CheckButton active={prefs.functions.favorites.includes(item.to)} onClick={() => toggleList('favorites', item.to)}>{t('settingsPage.functions.favorite')}</CheckButton>
                      <CheckButton active={prefs.functions.emphasized.includes(item.to)} onClick={() => toggleList('emphasized', item.to)}>{t('settingsPage.functions.emphasized')}</CheckButton>
                      <CheckButton active={prefs.functions.hidden.includes(item.to)} onClick={() => toggleList('hidden', item.to)}>{t('settingsPage.functions.hidden')}</CheckButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
