/**
 * Top-level React SPA. BrowserRouter + shared providers + AppShell outlet.
 * Each route is code-split with React.lazy so the landing stays small.
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { ActivePersonProvider } from './contexts/ActivePersonContext.jsx';
import { DatabaseStatusProvider } from './contexts/DatabaseStatusContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import Home from './routes/Home.jsx';

const Tree = lazy(() => import('./routes/Tree.jsx'));
const Charts = lazy(() => import('./routes/Charts.jsx'));
const Search = lazy(() => import('./routes/Search.jsx'));
const Duplicates = lazy(() => import('./routes/Duplicates.jsx'));
const Reports = lazy(() => import('./routes/Reports.jsx'));
const Books = lazy(() => import('./routes/Books.jsx'));
const ChangeLog = lazy(() => import('./routes/ChangeLog.jsx'));
const PersonEditor = lazy(() => import('./routes/PersonEditor.jsx'));
const FamilyEditor = lazy(() => import('./routes/FamilyEditor.jsx'));
const Places = lazy(() => import('./routes/Places.jsx'));
const Sources = lazy(() => import('./routes/Sources.jsx'));
const Events = lazy(() => import('./routes/Events.jsx'));
const Media = lazy(() => import('./routes/Media.jsx'));
const MapView = lazy(() => import('./routes/MapView.jsx'));
const Globe = lazy(() => import('./routes/Globe.jsx'));
const MapsDiagram = lazy(() => import('./routes/MapsDiagram.jsx'));
const SavedCharts = lazy(() => import('./routes/SavedCharts.jsx'));
const Statistics = lazy(() => import('./routes/Statistics.jsx'));
const Plausibility = lazy(() => import('./routes/Plausibility.jsx'));
const Maintenance = lazy(() => import('./routes/Maintenance.jsx'));
const Bookmarks = lazy(() => import('./routes/Bookmarks.jsx'));
const ToDos = lazy(() => import('./routes/ToDos.jsx'));
const Stories = lazy(() => import('./routes/Stories.jsx'));
const PersonGroups = lazy(() => import('./routes/PersonGroups.jsx'));
const DNAResults = lazy(() => import('./routes/DNAResults.jsx'));
const SourceRepositories = lazy(() => import('./routes/SourceRepositories.jsx'));
const Slideshow = lazy(() => import('./routes/Slideshow.jsx'));
const WorldHistory = lazy(() => import('./routes/WorldHistory.jsx'));
const Research = lazy(() => import('./routes/Research.jsx'));
const Templates = lazy(() => import('./routes/Templates.jsx'));
const Labels = lazy(() => import('./routes/Labels.jsx'));
const Quiz = lazy(() => import('./routes/Quiz.jsx'));
const Backup = lazy(() => import('./routes/Backup.jsx'));
const ExportRoute = lazy(() => import('./routes/Export.jsx'));

function Fallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
      Loading view…
    </div>
  );
}

function NotFound() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">404</div>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-5 max-w-md">
        The page you&rsquo;re looking for doesn&rsquo;t exist. It may have moved, or the link is mistyped.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        ← Go to Home
      </Link>
    </div>
  );
}

function L({ children }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
       <DatabaseStatusProvider>
        <ActivePersonProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="tree" element={<L><Tree /></L>} />
              <Route path="charts" element={<L><Charts /></L>} />
              <Route path="search" element={<L><Search /></L>} />
              <Route path="duplicates" element={<L><Duplicates /></L>} />
              <Route path="reports" element={<L><Reports /></L>} />
              <Route path="books" element={<L><Books /></L>} />
              <Route path="change-log" element={<L><ChangeLog /></L>} />
              <Route path="person/:id" element={<L><PersonEditor /></L>} />
              <Route path="family/:id" element={<L><FamilyEditor /></L>} />
              <Route path="places" element={<L><Places /></L>} />
              <Route path="sources" element={<L><Sources /></L>} />
              <Route path="events" element={<L><Events /></L>} />
              <Route path="media" element={<L><Media /></L>} />
              <Route path="map" element={<L><MapView /></L>} />
              <Route path="globe" element={<L><Globe /></L>} />
              <Route path="maps-diagram" element={<L><MapsDiagram /></L>} />
              <Route path="saved-charts" element={<L><SavedCharts /></L>} />
              <Route path="statistics" element={<L><Statistics /></L>} />
              <Route path="plausibility" element={<L><Plausibility /></L>} />
              <Route path="maintenance" element={<L><Maintenance /></L>} />
              <Route path="bookmarks" element={<L><Bookmarks /></L>} />
              <Route path="todos" element={<L><ToDos /></L>} />
              <Route path="stories" element={<L><Stories /></L>} />
              <Route path="groups" element={<L><PersonGroups /></L>} />
              <Route path="dna" element={<L><DNAResults /></L>} />
              <Route path="repositories" element={<L><SourceRepositories /></L>} />
              <Route path="slideshow" element={<L><Slideshow /></L>} />
              <Route path="world-history" element={<L><WorldHistory /></L>} />
              <Route path="research" element={<L><Research /></L>} />
              <Route path="templates" element={<L><Templates /></L>} />
              <Route path="labels" element={<L><Labels /></L>} />
              <Route path="quiz" element={<L><Quiz /></L>} />
              <Route path="backup" element={<L><Backup /></L>} />
              <Route path="export" element={<L><ExportRoute /></L>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ActivePersonProvider>
       </DatabaseStatusProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
