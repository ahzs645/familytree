import { useEffect, useState } from 'react';

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
