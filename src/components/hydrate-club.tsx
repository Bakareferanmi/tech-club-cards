import { useEffect, useState, type ReactNode } from "react";
import { bindClubPersistence } from "@/lib/club-store";

export function HydrateClub({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = bindClubPersistence();
    setReady(true);
    return unsub;
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <span className="font-display text-2xl font-extrabold tracking-tight">
            <span className="text-primary">TECH</span> CLUB
          </span>
          <p className="text-sm text-muted">Preparing the card studio…</p>
        </div>
      </div>
    );
  }

  return children;
}
