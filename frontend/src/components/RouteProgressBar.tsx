import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingBar, { LoadingBarRef } from 'react-top-loading-bar';

export default function RouteProgressBar() {
  const location = useLocation();
  const loadingBarRef = useRef<LoadingBarRef>(null);

  useEffect(() => {
    // Start progress on location change
    loadingBarRef.current?.continuousStart();
    
    // Finish progress after a short delay (simulating page load/render)
    const timeout = setTimeout(() => {
      loadingBarRef.current?.complete();
    }, 400);

    return () => clearTimeout(timeout);
  }, [location.pathname]);

  return (
    <LoadingBar
      color="#10b981" // emerald-500
      ref={loadingBarRef}
      shadow={true}
      height={3}
      waitingTime={400}
    />
  );
}
