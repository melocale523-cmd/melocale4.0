import { useCallback, useRef, useState } from 'react';

export function useInView(options?: IntersectionObserverInit): [React.RefCallback<HTMLDivElement>, boolean] {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observerRef.current?.disconnect();
      }
    }, { threshold: 0.1, ...options });
    observerRef.current.observe(node);
  }, []);

  return [ref, inView];
}
