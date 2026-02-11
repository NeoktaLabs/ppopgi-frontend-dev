// src/hooks/useRevalidateTick.ts
import { useEffect, useState } from "react";
import { subscribeRevalidate } from "../lib/revalidate";

/**
 * Hook that forces a component refresh
 * whenever revalidation is triggered.
 */
export function useRevalidateTick() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeRevalidate(() => {
      setTick((v) => v + 1);
    });

    return unsub;
  }, []);
}