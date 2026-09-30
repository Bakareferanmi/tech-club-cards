import { forwardRef } from "react";
import { AccessCard } from "@/components/access-card";
import { cardVerifyUrl } from "@/lib/payload";
import { CARDS_PER_SECTION, sectionOf, type Member } from "@/lib/club-store";

export const CARDS_PER_PAGE = 8;

function idNumber(id: string) {
  const match = /(\d+)\s*$/.exec(id.trim());
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function chunkMembers(members: Member[], size = CARDS_PER_PAGE) {
  const sorted = [...members].sort((a, b) => {
    const x = idNumber(a.memberId);
    const y = idNumber(b.memberId);
    return x === y ? 0 : x < y ? -1 : 1;
  });

  const bySection = new Map<number, Member[]>();
  for (const m of sorted) {
    const s = sectionOf(m.memberId);
    bySection.set(s, [...(bySection.get(s) ?? []), m]);
  }

  const pages: Member[][] = [];
  for (const [, list] of [...bySection.entries()].sort((a, b) => a[0] - b[0])) {
    for (let i = 0; i < list.length; i += size) {
      pages.push(list.slice(i, i + size));
    }
  }
  return pages.length ? pages : [[]];
}

const pad = (n: number) => String(n).padStart(3, "0");

function sectionLabel(members: Member[]) {
  const first = members[0];
  if (!first) return null;
  const section = sectionOf(first.memberId);
  const start = (section - 1) * CARDS_PER_SECTION + 1;
  const end = section * CARDS_PER_SECTION;
  return `Section ${section} · ${pad(start)}–${pad(end)}`;
}

type Props = {
  members: Member[];
  origin: string;
  pageNumber: number;
  pageCount: number;
};

export const PrintSheet = forwardRef<HTMLElement, Props>(function PrintSheet(
  { members, origin, pageNumber, pageCount },
  ref,
) {
  const slots = Array.from({ length: CARDS_PER_PAGE }, (_, i) => members[i] ?? null);
  const label = sectionLabel(members);

  return (
    <section
      ref={ref}
      className="print-sheet"
      style={{ position: "relative" }}
      aria-label={`A4 sheet ${pageNumber} of ${pageCount}`}
    >
      <div className="print-sheet__grid">
        {slots.map((member, index) => (
          <div className="print-slot" key={member?.uid ?? `empty-${pageNumber}-${index}`}>
            <span className="crop-mark crop-mark--tl" />
            <span className="crop-mark crop-mark--tr" />
            <span className="crop-mark crop-mark--bl" />
            <span className="crop-mark crop-mark--br" />
            {member ? (
              <AccessCard
                data={{
                  name: member.name,
                  memberId: member.memberId,
                  role: member.role,
                  session: member.session,
                  verifyUrl: cardVerifyUrl(origin, {
                    n: member.name,
                    i: member.memberId,
                    r: member.role,
                    s: member.session,
                  }),
                }}
              />
            ) : (
              <div className="print-slot__empty" />
            )}
          </div>
        ))}
      </div>
      {label ? (
        <p
          style={{
            position: "absolute",
            bottom: "3mm",
            left: 0,
            right: 0,
            margin: 0,
            textAlign: "center",
            fontSize: "7pt",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          {label}
        </p>
      ) : null}
    </section>
  );
});
