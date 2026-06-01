import { useEffect, useState } from 'react';

// Layout-mode boundary: <=767px renders the mobile overlay shell, >=768px the
// desktop drawer. This aligns with Tailwind's `md:` breakpoint (768px) so the
// JS layout switch matches CSS media queries. NOTE: this is distinct from the
// `sm:` (640px) breakpoint used for form-grid stacking — do not conflate them.
const QUERY = '(max-width: 767px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return isMobile;
}

export default useIsMobile;
