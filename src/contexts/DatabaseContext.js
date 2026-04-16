/**
 * DatabaseContext — provides the current database to all components.
 * Was `va` in the minified code.
 *
 * Usage:
 *   const { database, locale, setBlockUserInterface } = useContext(DatabaseContext);
 *
 * The context value contains:
 * - database: The currently selected app-level Database object (or null)
 * - locale: Current locale string (e.g., 'en')
 * - setBlockUserInterface: Function to show/hide the full-screen loading blocker
 */
import { createContext } from 'react';

export const DatabaseContext = createContext();

export default DatabaseContext;
