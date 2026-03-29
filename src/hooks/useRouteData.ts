import { useState, useEffect, useRef } from "react";
import type { AirportRoutes } from "@/lib/types";

const cache = new Map<string, AirportRoutes>();

export function useRouteData(iata: string | null) {
  const [data, setData] = useState<AirportRoutes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!iata) {
      setData(null);
      return;
    }

    const code = iata.toLowerCase();

    if (cache.has(code)) {
      setData(cache.get(code)!);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/data/routes/${code}.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`No route data for ${iata}`);
        return res.json();
      })
      .then((json: AirportRoutes) => {
        cache.set(code, json);
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [iata]);

  return { data, loading, error };
}
