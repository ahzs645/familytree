/**
 * Top-level React SPA. BrowserRouter + shared providers + AppShell outlet.
 * Each route is code-split with React.lazy so the landing stays small.
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
const Classic = lazy(() => import('./routes/Classic.jsx'));

function Fallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b90a0', fontSize: 13 }}>
      Loading view…
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
              <Route path="classic" element={<L><Classic /></L>} />
            </Route>
          </Routes>
        </ActivePersonProvider>
       </DatabaseStatusProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
