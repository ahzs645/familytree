/**
 * Top-level React SPA. BrowserRouter + shared providers + AppShell outlet.
 * Each route is code-split with React.lazy so the landing stays small.
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { ActivePersonProvider } from './contexts/ActivePersonContext.jsx';
import { DatabaseStatusProvider } from './contexts/DatabaseStatusContext.jsx';
import Home from './routes/Home.jsx';

const Tree = lazy(() => import('./routes/Tree.jsx'));
const Charts = lazy(() => import('./routes/Charts.jsx'));
const Search = lazy(() => import('./routes/Search.jsx'));
const Duplicates = lazy(() => import('./routes/Duplicates.jsx'));
const Reports = lazy(() => import('./routes/Reports.jsx'));
const Books = lazy(() => import('./routes/Books.jsx'));

function Fallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8b90a0', fontSize: 13 }}>
      Loading view…
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <DatabaseStatusProvider>
        <ActivePersonProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route
                path="tree"
                element={
                  <Suspense fallback={<Fallback />}>
                    <Tree />
                  </Suspense>
                }
              />
              <Route
                path="charts"
                element={
                  <Suspense fallback={<Fallback />}>
                    <Charts />
                  </Suspense>
                }
              />
              <Route
                path="search"
                element={
                  <Suspense fallback={<Fallback />}>
                    <Search />
                  </Suspense>
                }
              />
              <Route
                path="duplicates"
                element={
                  <Suspense fallback={<Fallback />}>
                    <Duplicates />
                  </Suspense>
                }
              />
              <Route
                path="reports"
                element={
                  <Suspense fallback={<Fallback />}>
                    <Reports />
                  </Suspense>
                }
              />
              <Route
                path="books"
                element={
                  <Suspense fallback={<Fallback />}>
                    <Books />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </ActivePersonProvider>
      </DatabaseStatusProvider>
    </BrowserRouter>
  );
}

export default App;
