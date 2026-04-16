/**
 * ModalContext — controls modal dialog display.
 * Was `me` in the minified code.
 *
 * Usage:
 *   const { setShowModal, setModalParameters } = useContext(ModalContext);
 */
import { createContext } from 'react';

export const ModalContext = createContext();

export default ModalContext;
