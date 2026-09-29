import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { AccessCard } from "@/components/access-card";
import { CardStage } from "@/components/card-stage";
import { Button } from "@/components/ui/button";
import { getCard } from "@/lib/cards.functions";
import { cardVerifyUrl, decodePayload } from "@/lib/payload";
import { useOrigin } from "@/lib/use-origin";

type VerifySearch = { p?: string };
type Card = { name: string; memberId: string; role: string; session: string };
type State =
  | { status: "loading" }
  | { status: "found"; card: Card }
  | { status: "missing" }
  | { status: "error" };

export const Route = createFileRoute("/verify")({
  validateSearch: (search: Record<string, unknown>): VerifySearch => ({
    p: typeof search.p === "string" ? search.p : undefined,
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { p } = Route.useSearch();
  const origin = useOrigin();
  const payload = p ? decodePayload(p) : null;
  const memberId = payload?.i;
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    setState({ status: "loading" });
    getCard({ data: { memberId } })
      .then((card) => {
        if (!cancelled) setState(card ? { status: "found", card } : { status: "missing" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const invalid = !payload || state.status === "missing";

  return (
    <main className="min-h-dvh bg-bg px-4 py-10 text-fg">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
        <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-muted">
          Tech Club verification
        </p>
        {!invalid && state.status === "loading" && (
          <p className="text-sm text-muted">Checking card…</p>
        )}
        {!invalid && state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-danger">
            Could not reach the records. Check your connection and scan again.
          </p>
        )}
        {!invalid && state.status === "found" && (
          <>
            <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-navy ring-1 ring-border">
              <ShieldCheck className="size-4 text-primary" />
              Valid access card
            </div>
            <CardStage>
              <AccessCard
                data={{
                  name: state.card.name,
                  memberId: state.card.memberId,
                  role: state.card.role,
                  session: state.card.session,
                  verifyUrl: cardVerifyUrl(origin, {
                    n: state.card.name,
                    i: state.card.memberId,
                    r: state.card.role,
                    s: state.card.session,
                  }),
                }}
              />
            </CardStage>
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-center">
              <p className="font-display text-xl font-bold text-navy">{state.card.name}</p>
              <p className="mt-1 text-sm text-muted">
                {state.card.memberId} · {state.card.role} · {state.card.session}
              </p>
              <p className="mt-3 text-sm text-muted">
                This card is registered to a Tech Club member.
              </p>
            </div>
          </>
        )}
        {invalid && (
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
            <ShieldX className="mx-auto size-8 text-danger" />
            <h1 className="mt-3 font-display text-xl font-bold text-navy">
              Card could not be verified
            </h1>
            <p className="mt-2 text-sm text-muted">
              This card isn't in the club records. Scan a Tech Club access card to try again.
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/scan">Scan another card</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">Open card studio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
