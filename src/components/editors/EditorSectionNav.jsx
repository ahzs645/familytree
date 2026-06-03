/**
 * In-page section navigation for long record editors.
 *
 * Sections register themselves through context (no hard-coded list), so the
 * jump bar stays in sync as sections appear/disappear (collapsible, conditional
 * blocks, etc.). The bar is rendered between the editor header and the scroll
 * area so it stays pinned; clicking a chip scrolls its section into view, and
 * an IntersectionObserver highlights whichever section is currently on screen.
 *
 * When no provider is present (most other Section usages), the hook is inert —
 * Section works exactly as before.
 */
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';

const SectionNavContext = createContext(null);

export function EditorSectionNavProvider({ children }) {
  const [sections, setSections] = useState([]);
  const register = useCallback((entry) => {
    setSections((prev) => {
      const next = prev.filter((s) => s.id !== entry.id);
      next.push(entry);
      return next;
    });
  }, []);
  const unregister = useCallback((id) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, []);
  const value = useMemo(() => ({ sections, register, unregister }), [sections, register, unregister]);
  return <SectionNavContext.Provider value={value}>{children}</SectionNavContext.Provider>;
}

/**
 * Called by <Section>. Returns a ref to attach to the section root and an id;
 * registers the section with the nav while mounted. Inert without a provider.
 */
export function useEditorSection(title) {
  const ctx = useContext(SectionNavContext);
  const id = useId();
  const ref = useRef(null);
  // Depend on the stable register/unregister callbacks, NOT the whole context
  // value: `register` updates `sections`, which recreates the context value on
  // every registration. Depending on `ctx` here would re-run this effect on
  // that new identity → re-register → infinite "Maximum update depth" loop.
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  useEffect(() => {
    if (!register || !ref.current) return undefined;
    register({ id, title, el: ref.current });
    return () => unregister(id);
  }, [register, unregister, id, title]);

  return { id: ctx ? id : undefined, ref, enabled: !!ctx };
}

export function EditorSectionNavBar({ className }) {
  const ctx = useContext(SectionNavContext);
  const [activeId, setActiveId] = useState(null);
  // Map of section id -> chip button element, so we can scroll the active chip
  // into view (the strip shows only a few chips on mobile).
  const chipRefs = useRef(new Map());

  const scrollChipIntoView = useCallback((id) => {
    const chip = chipRefs.current.get(id);
    chip?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, []);

  const ordered = useMemo(() => {
    const list = [...(ctx?.sections || [])].filter((s) => s.el && s.title);
    return list.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      // eslint-disable-next-line no-bitwise
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      // eslint-disable-next-line no-bitwise
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }, [ctx?.sections]);

  useEffect(() => {
    if (ordered.length < 2) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const match = ordered.find((s) => s.el === visible[0].target);
        if (match) {
          setActiveId(match.id);
          scrollChipIntoView(match.id);
        }
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 }
    );
    ordered.forEach((s) => observer.observe(s.el));
    return () => observer.disconnect();
  }, [ordered, scrollChipIntoView]);

  if (ordered.length < 2) return null;

  return (
    <nav
      aria-label="Editor sections"
      className={cn(
        'no-scrollbar flex items-center gap-1 snap-x scroll-px-4 overflow-x-auto border-b border-border bg-card/90 px-4 py-1.5 backdrop-blur',
        '[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]',
        className
      )}
    >
      {ordered.map((s) => (
        <button
          key={s.id}
          type="button"
          ref={(el) => {
            if (el) chipRefs.current.set(s.id, el);
            else chipRefs.current.delete(s.id);
          }}
          onClick={() => {
            s.el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            scrollChipIntoView(s.id);
          }}
          className={cn(
            'snap-start whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors',
            s.id === activeId
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {s.title}
        </button>
      ))}
    </nav>
  );
}
