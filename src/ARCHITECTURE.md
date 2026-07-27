# Architecture

CloudTreeWeb is a browser-local family-tree application (~95k lines of source).
It began as a reconstruction of the original CloudTreeWeb bundle but has since
grown into a full app with its own structure, described here.

## Entry and shell

- `main.jsx` → `App.jsx`: `BrowserRouter` wrapping the provider stack
  (`ThemeProvider` → `LocalizationProvider` → `ModalProvider` →
  `DatabaseStatusProvider` → `ActivePersonProvider` → `RemoteDatasetProvider`).
- Routes are declared as **data** in `routes/manifest.js` and unrolled in
  `App.jsx`; every leaf is `React.lazy()` so the landing route stays small
  (Vite splits chunks per route — see the `Tree`/`HeritageTree` chunks).
- `components/AppShell.jsx` renders the persistent chrome (navigation drawer,
  command palette, tree switcher, status) around the route outlet.

## Layers

```
src/
├── routes/       68 route components — thin screens; feature UIs live in components/
├── components/   App chrome + one folder per feature area:
│   │             books, charts, duplicates, editors, heritageTree, interactive,
│   │             lists, media, personEditor, presentation, reports, search, settings
│   └── ui/       Shared primitives: Button, Input/Textarea, Select, Sheet, Panel,
│                 DatePicker, Map, formClasses (canonical class strings)
├── lib/          ~170 plain-JS domain/service modules with colocated *.test.js.
│   │             Data access, import/export (GEDCOM, MFTPKG, GeneWeb), family
│   │             graph, duplicates, reports, website export, FamilySearch API…
│   ├── chartData/  chart dataset builders (statistics, timeline, genogram, …)
│   ├── gedcom/, geneweb/, reports/, website/, data/  format- and feature-specific
│   └── LocalDatabase.js  ← THE data boundary (see below)
├── models/       Record classes (BaseRecord + Person/Family/Place/Source/Event),
│                 constants/enums, and wrap.js summary helpers
├── contexts/     ActivePerson, DatabaseStatus, Localization, Modal, Theme
├── locales/      i18n resources (the app is fully translatable and RTL-capable)
├── data/         bundled sample data
└── utils/        tiny generic helpers (formatDate, humanizeType)
```

## Data access

`lib/LocalDatabase.js` is a Dexie/IndexedDB adapter and the intended boundary
for all record storage: records are stored by `recordName`/`recordType` with
meta and asset stores alongside. The rest of the app goes through this module
(via `getLocalDatabase()`) rather than touching Dexie directly, so a future
remote adapter can keep the same command surface. `lib/schema.js` and
`models/` define record shapes; `lib/datasetSchemaVersion.js` +
`components/SchemaMigrationSheet.jsx` handle dataset migrations.

## Styling conventions

- **Tailwind + design tokens.** Tokens are shadcn-style HSL CSS variables
  defined in `src/index.css` (`:root` and `.dark`) and mapped in
  `tailwind.config.js`: `background`, `foreground`, `card`, `popover`,
  `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`,
  `warning`, `border`, `input`, `ring` (each color has a paired
  `-foreground`).
- **Use the primitives**, don't hand-roll controls: `ui/Button.jsx`
  (variants primary/secondary/outline/ghost/destructive/destructiveOutline;
  `buttonClasses()` for non-`<button>` elements), `ui/Input.jsx`,
  `ui/Select.jsx`, `ui/formClasses.js`.
- **Token pairing rule:** a token background always takes its paired
  foreground (`bg-primary` + `text-primary-foreground`, etc.). Never hardcode
  `#fff`/`#000` text on token backgrounds.
- **No inline `style` for static styling.** Inline styles are reserved for
  genuinely dynamic values (computed positions, transforms, data-driven
  colors).
- **RTL:** use logical utilities (`ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`,
  `border-s`/`border-e`, `text-start`).
- **Sanctioned exceptions:** canvas/WebGL/SVG-export code cannot read CSS
  variables — chart palettes live in `components/charts/theme.js`, 3D-tree
  palettes in `components/interactive/threeDTree/`, MapLibre paint colors in
  `ui/Map.jsx`. `components/heritageTree/heritageTree.css` is an intentionally
  self-contained decorative print theme.

## Legacy artifacts

`public/classic.html` is a redirect kept for old bookmarks; the SPA has no
legacy-bundle runtime dependency. `scripts/validate-mft-parity.mjs`
(`npm run parity`) validates MFTPKG import parity against MacFamilyTree
package files.

## Testing

`vitest` (`npm test`). Coverage is concentrated in `lib/` as colocated
`*.test.js` files next to the module under test — new domain logic should
follow that pattern and stay out of route components so it stays testable.
