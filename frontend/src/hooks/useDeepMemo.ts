import { useRef } from 'react';

export function useDeepMemo<T>(factory: () => T, deps: unknown[]): T {
  const ref = useRef<{ value: T; key: string } | undefined>(undefined);
  const key = JSON.stringify(deps);

  if (!ref.current || ref.current.key !== key) {
    ref.current = { value: factory(), key };
  }

  return ref.current.value;
}
