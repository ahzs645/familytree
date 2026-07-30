/**
 * Shared "open the person menu" gesture for every tree view.
 *
 * The Add-relatives menu used to exist only in the 3D view, bound only to
 * `contextmenu` — so switching to Flat, Sun, Family or Canvas lost the ability
 * to add a father/partner/child entirely, and a phone (which has no
 * right-click) never had it anywhere.
 *
 * This gives any view the same two ways in: right-click on a pointer device,
 * long press on a touch one. Views attach `handlersFor(payload)` to whatever
 * element represents a person and render <PersonContextMenu> from `menu`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const LONG_PRESS_MS = 500;
/** Movement past this many pixels is a pan/scroll, not a press. */
const MOVE_TOLERANCE_PX = 8;

export function usePersonContextMenu({ longPressMs = LONG_PRESS_MS } = {}) {
  const [menu, setMenu] = useState(null);
  const timerRef = useRef(0);
  const originRef = useRef(null);
  // A long press opens the menu while the finger is still down; the click that
  // follows must not also activate the node underneath.
  const swallowClickRef = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = 0;
    originRef.current = null;
  }, []);

  useEffect(() => () => cancelLongPress(), [cancelLongPress]);

  const close = useCallback(() => setMenu(null), []);

  const open = useCallback((payload, clientX, clientY) => {
    setMenu({ ...payload, x: clientX, y: clientY });
  }, []);

  const handlersFor = useCallback((payload) => {
    if (!payload?.person) return {};
    return {
      onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelLongPress();
        open(payload, event.clientX, event.clientY);
      },
      onPointerDown: (event) => {
        cancelLongPress();
        if (event.pointerType !== 'touch') return;
        const { clientX, clientY } = event;
        originRef.current = { x: clientX, y: clientY };
        timerRef.current = setTimeout(() => {
          timerRef.current = 0;
          swallowClickRef.current = true;
          open(payload, clientX, clientY);
        }, longPressMs);
      },
      onPointerMove: (event) => {
        const origin = originRef.current;
        if (!origin) return;
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_TOLERANCE_PX) cancelLongPress();
      },
      onPointerUp: cancelLongPress,
      onPointerCancel: cancelLongPress,
      onPointerLeave: cancelLongPress,
      onClickCapture: (event) => {
        if (!swallowClickRef.current) return;
        swallowClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    };
  }, [cancelLongPress, longPressMs, open]);

  return { menu, open, close, handlersFor };
}

export default usePersonContextMenu;
