"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo } from "react";

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      return null;
    }
    return new ConvexReactClient(url);
  }, []);

  if (!convex) {
    return (
      <main className="public-page">
        <section className="public-shell card">
          <p className="eyebrow">Configuration requise</p>
          <h1 className="page-title">Convex n’est pas configuré</h1>
          <p className="muted">
            Définissez <code>NEXT_PUBLIC_CONVEX_URL</code> dans <code>.env.local</code>, puis lancez Convex avec{" "}
            <code>npm run convex:dev</code>.
          </p>
        </section>
      </main>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
