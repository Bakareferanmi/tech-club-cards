import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ShieldX } from "lucide-react";
import { AccessCard } from "@/components/access-card";
import { CardStage } from "@/components/card-stage";
import { Button } from "@/components/ui/button";
import { cardVerifyUrl, decodePayload } from "@/lib/payload";
import { useOrigin } from "@/lib/use-origin";

type VerifySearch = { p?: string };

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

  return (
    <main className="min-h-dvh bg-bg px-4 py-10 text-fg">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
        <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-muted">
          Tech Club verification
        </p>
        {payload ? (
          <>
            <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-navy ring-1 ring-border">
              <ShieldCheck className="size-4 text-primary" />
              Valid access card
            </div>
            <CardStage>
              <AccessCard
                data={{
                  name: payload.n,
                  memberId: payload.i,
                  role: payload.r,
                  session: payload.s,
                  verifyUrl: cardVerifyUrl(origin, payload),
                }}
              />
            </CardStage>
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-center">
              <p className="font-display text-xl font-bold text-navy">{payload.n}</p>
              <p className="mt-1 text-sm text-muted">
                {payload.i} · {payload.r} · {payload.s}
              </p>
              <p className="mt-3 text-sm text-muted">
                This QR belongs to a Tech Club member for the printed session on the card.
              </p>
            </div>
          </>
        ) : (
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
            <ShieldX className="mx-auto size-8 text-danger" />
            <h1 className="mt-3 font-display text-xl font-bold text-navy">
              Card could not be verified
            </h1>
            <p className="mt-2 text-sm text-muted">
              The QR code is missing or invalid. Scan a Tech Club access card to try again.
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
