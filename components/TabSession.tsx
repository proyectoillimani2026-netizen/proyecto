"use client";

import { useLayoutEffect } from "react";

export function TabSession() {
  useLayoutEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
      const role = sessionStorage.getItem("ie_role");
      if (!sameOrigin || !url.includes("/api/") || !role) return original(input, init);
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has("x-ie-role")) headers.set("x-ie-role", role);
      return original(input, { ...init, headers });
    };
    return () => {
      window.fetch = original;
    };
  }, []);
  return null;
}
