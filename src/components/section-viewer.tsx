import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { AccessCard } from "@/components/access-card";
import { CardStage } from "@/components/card-stage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CARDS_PER_SECTION, sectionOf, useClub, type Member } from "@/lib/club-store";
import { cardVerifyUrl } from "@/lib/payload";
import { useOrigin } from "@/lib/use-origin";

const pad = (n: number) => String(n).padStart(3, "0");

function idNumber(id: string) {
  const match = /(\d+)\s*$/.exec(id.trim());
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function groupBySection(members: Member[]) {
  const map = new Map<number, Member[]>();
  for (const m of members) {
    const s = sectionOf(m.memberId);
    map.set(s, [...(map.get(s) ?? []), m]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([section, list]) => ({
      section,
      list: [...list].sort((a, b) => idNumber(a.memberId) - idNumber(b.memberId)),
    }));
}

export function SectionViewer() {
  const origin = useOrigin();
  const members = useClub((s) => s.members);
  const selectedId = useClub((s) => s.selectedId);
  const select = useClub((s) => s.select);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const sections = useMemo(() => groupBySection(members), [members]);
  const safeIndex = Math.min(index, Math.max(0, sections.length - 1));
  const current = sections[safeIndex];

  function onOpenChange(next: boolean) {
    if (next) {
      const selected = members.find((m) => m.uid === selectedId);
      const target = selected ? sectionOf(selected.memberId) : null;
      const found = sections.findIndex((s) => s.section === target);
      setIndex(found >= 0 ? found : 0);
    }
    setOpen(next);
  }

  const rangeLabel = current
    ? `${pad((current.section - 1) * CARDS_PER_SECTION + 1)}–${pad(current.section * CARDS_PER_SECTION)}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Layers />
          By section
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] w-[min(1100px,calc(100vw-1.5rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {current ? `Section ${current.section} · ${rangeLabel}` : "Cards by section"}
          </DialogTitle>
          <DialogDescription>
            {current
              ? `${current.list.length} of ${CARDS_PER_SECTION} cards · section ${safeIndex + 1} of ${sections.length}. Tap a card to edit it.`
              : "No cards yet. Add a member in the studio first."}
          </DialogDescription>
        </DialogHeader>

        {current ? (
          <div className="grid gap-4 md:grid-cols-2">
            {current.list.map((m) => (
              <button
                key={m.uid}
                type="button"
                onClick={() => {
                  select(m.uid);
                  setOpen(false);
                }}
                className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`Edit ${m.name}`}
              >
                <CardStage>
                  <AccessCard
                    data={{
                      name: m.name,
                      memberId: m.memberId,
                      role: m.role,
                      session: m.session,
                      verifyUrl: cardVerifyUrl(origin, {
                        n: m.name,
                        i: m.memberId,
                        r: m.role,
                        s: m.session,
                      }),
                    }}
                  />
                </CardStage>
              </button>
            ))}
          </div>
        ) : null}

        {sections.length > 1 ? (
          <div className="sticky bottom-0 -mx-5 mt-4 flex items-center justify-between gap-2 border-t border-border bg-surface px-5 pt-4">
            <Button
              variant="secondary"
              onClick={() => setIndex(safeIndex - 1)}
              disabled={safeIndex === 0}
            >
              <ChevronLeft />
              Previous
            </Button>
            <span className="text-xs text-muted">
              {safeIndex + 1} / {sections.length}
            </span>
            <Button
              onClick={() => setIndex(safeIndex + 1)}
              disabled={safeIndex === sections.length - 1}
            >
              Next section
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
