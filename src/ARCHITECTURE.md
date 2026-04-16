# CloudTreeWeb — Reconstructed Architecture

## Minified Name → Meaningful Name Reference

### Webpack Modules (npm replacements)

| Module | Minified | NPM Package | Status |
|--------|----------|-------------|--------|
| 313/306 | `t` | `react` ^18.x | Replaced via npm |
| 417/918 | `re` | `react/jsx-runtime` (jsx, jsxs) | Replaced via npm |
| 739/168 | `o` | `react-dom/client` (createRoot) | Replaced via npm |
| 534 | — | `react-dom` ^18.x | Replaced via npm |
| 95/224 | — | `scheduler` (React internal) | Replaced via npm |
| 937/757 | — | `regenerator-runtime` | Replaced via npm |
| 962 | `ga`/`ba` | CloudKit JS SDK | Replaced by shim |
| 786/318/171 | `ne` | Custom GA4 wrapper | → `src/utils/analytics.js` |
| 377 | — | Custom title-case | → `src/utils/titleCase.js` |

### Core Singletons & Globals

| Minified | Meaningful | Type | Location |
|----------|-----------|------|----------|
| `ka` | `appController` | AppController instance | `src/lib/AppController.js` |
| `_a` | `localize(key, table)` | Bound localizer function | `src/lib/Localizer.js` |
| `ca` / `la` | `DatabasesController` | Class | `src/lib/DatabasesController.js` |
| `va` | `DatabaseContext` | React.createContext | `src/contexts/DatabaseContext.js` |
| `me` | `ModalContext` | React.createContext | `src/contexts/ModalContext.js` |
| `sa` | `ZONE_SEPARATOR` | `"#####"` | `src/models/constants.js` |

### Model Classes

| Minified | Meaningful | Record Type | Location |
|----------|-----------|-------------|----------|
| `st`/`lt` | `BaseRecord` | (base class) | `src/models/BaseRecord.js` |
| `ft`/`dt` | `PersonRecord` | Person | `src/models/PersonRecord.js` |
| `ht`/`pt` | `FamilyRecord` | Family | `src/models/FamilyRecord.js` |
| `_t`/`kt` | `PlaceRecord` | Place | `src/models/PlaceRecord.js` |
| `Tt`/`Nt` | `SourceRecord` | Source | `src/models/SourceRecord.js` |
| `no`/`ro` | `PersonEventRecord` | PersonEvent | `src/models/EventRecord.js` |
| `oo`/`ao` | `FamilyEventRecord` | FamilyEvent | `src/models/EventRecord.js` |
| `ct` | `Gender` | Enum | `src/models/constants.js` |

### Record Type Class Map (047/049 files)

These classes all extend BaseRecord and represent CloudKit record types:

| Minified | Record Type |
|----------|------------|
| `Hr`/`Zr` | Person |
| `Yr`/`$r` | Family |
| `Jr`/`Xr` | PersonEvent |
| `eo`/`to` | FamilyEvent |
| `no`/`ro` | PersonFact |
| `oo`/`ao` | Place |
| `io`/`uo` | Source |
| `so`/`lo` | MediaPicture |
| `co`/`fo` | MediaPDF |
| `po`/`ho` | MediaURL |
| `mo`/`vo` | MediaAudio |
| `yo`/`go` | MediaVideo |
| `bo`/`Co` | Note |
| `_o`/`xo` | DNATestResult |
| `wo`/`No` | ChildRelation |
| `To`/`So` | AdditionalName |
| `jo`/`Eo` | AssociateRelation |
| `Ro`/`Po` | Label |
| `Io`/`Do` | LabelRelation |
| `Oo`/`Fo` | PersonGroup |
| `Ao`/`Lo` | PersonGroupRelation |
| `Mo`/`zo` | Story |
| `Vo`/`Ko` | StorySection |
| `Uo`/`Bo` | ToDo |
| `Qo`/`Wo` | ToDoRelation |
| `Go`/`qo` | SourceRelation |
| `Ho`/`Zo` | FamilyTreeInformation |
| `Yo`/`$o` | ChangeLogEntry |
| `Jo`/`Xo` | ChangeLogSubEntry |
| `ea`/`ta` | MediaRelation |
| `na`/`ra` | Coordinate |
| `oa` | SourceRepository |

### React Components

| Minified | Meaningful | Description |
|----------|-----------|-------------|
| `oe` | `LoadingSpinner` | Animated spinner |
| `ae` | `LoggedInUserPopover` | User menu popover with sign-out |
| `ie` | `LoggedInUserButton` | Username + chevron in header |
| `se` | `ActionsMenuButton` | "Actions" dropdown in footer |
| `de`/`ve` | `HeaderBar`/`MainLayout` | App shell layout |
| `fe` | `ImageComponent` | Image display from URL/base64 |
| `he` | `ModalDialog` | Modal popup container |
| `At` | `ObjectListComponent` | Search/filter list with pagination |
| `Mt` | `EditSectionLayout` | Collapsible edit section with icon |
| `zt` | `EditTitleComponent` | Page title with image and subtitle |
| `Vt` | `EditContentBox` | Content container for edit views |

### Page Components (Router)

| Minified | Route | Description |
|----------|-------|-------------|
| `Ie` | `/databases` | Database picker (family tree list) |
| `Oe` | `/edit-overview` | Edit overview with 5 module icons |
| `ir` | `/editperson` | Edit person details |
| `fr` | `/editfamily` | Edit family details |
| `Or` | `/editplace` | Edit place details |
| `vr` | `/editevent` | Edit event details |
| `Vr` | `/editsource` | Edit source/citation |
| `Ur` | `/editmedia` | Edit media attachment |
| `Kt` | `/change-log` | Change log viewer |
| `Wr` | `/login` | Login page |
| `ha` | `/imprint` | Legal imprint page |
| `ma` | `/instructions` | How-to instructions |

### React Hooks (from React Router)

| Minified | Meaningful | From Package |
|----------|-----------|-------------|
| `M()` | `useNavigate()` | react-router-dom |
| `L()` | `useLocation()` | react-router-dom |
| `V()` | `useOutletContext()` | react-router-dom |
| `ee()` | `useSearchParams()` | react-router-dom |
| `J` | `BrowserRouter` | react-router-dom |
| `W` | `Route` | react-router-dom |
| `q` | `Routes` | react-router-dom |
| `B` | `Navigate` | react-router-dom |
| `X` | `Link` | react-router-dom |

### Utility Functions

| Minified | Meaningful | Location |
|----------|-----------|----------|
| `s(arr,n)` | `arraySlice` | `src/utils/helpers.js` |
| `u(iter)` | `createSafeIterator` | `src/utils/helpers.js` |
| `ge(fn)` | `asyncGeneratorRunner` | `src/utils/helpers.js` |
| `tt()` | `generateUUID` | `src/utils/helpers.js` |
| `xe(a,b)` | `assertClassInstance` | `src/utils/helpers.js` |
| `we(p,m)` | `defineClassMethods` | `src/utils/helpers.js` |
| `Ne(C,p,s)` | `createClass` | `src/utils/helpers.js` |

## Directory Structure

```
src/
├── main.jsx                    Entry point (loads alongside legacy bundle)
├── ARCHITECTURE.md             This file
├── lib/
│   ├── AppController.js        Main app controller (ka/Ca)
│   ├── DatabasesController.js  Database selection (ca/la)
│   └── Localizer.js            String localization (Se/Te)
├── models/
│   ├── index.js                All model exports
│   ├── constants.js            Enums (Gender, ChangeType, etc.)
│   ├── BaseRecord.js           Base record class (st/lt)
│   ├── PersonRecord.js         Person model (ft/dt)
│   ├── FamilyRecord.js         Family model (ht/pt)
│   ├── PlaceRecord.js          Place model (_t/kt)
│   ├── EventRecord.js          Event models (PersonEvent, FamilyEvent)
│   └── SourceRecord.js         Source model (Tt/Nt)
├── components/
│   ├── index.js                Component exports with name mapping
│   ├── LoadingSpinner.jsx      Loading indicators (oe, da, pa)
│   └── ImageComponent.jsx      Image display (fe)
├── contexts/
│   ├── DatabaseContext.js       Database context (va)
│   └── ModalContext.js          Modal context (me)
└── utils/
    ├── helpers.js              Array/async/UUID utilities
    ├── analytics.js            Google Analytics wrapper
    └── titleCase.js            String formatting
```
