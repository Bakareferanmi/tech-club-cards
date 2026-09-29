import { forwardRef } from "react";
import { AccessCard } from "@/components/access-card";
import { cardVerifyUrl } from "@/lib/payload";
import type { Member } from "@/lib/club-store";

export const CARDS_PER_PAGE = 10;

export function chunkMembers(members: Member[], size = CARDS_PER_PAGE) {
  const pages: Member[][] = [];
  for (let i = 0; i < members.length; i += size) {
    pages.push(members.slice(i, i + size));
  }
  return pages.length ? pages : [[]];
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

  return (
    <section ref={ref} className="print-sheet" aria-label={`A4 sheet ${pageNumber} of ${pageCount}`}>
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
    </section>
  );
});
