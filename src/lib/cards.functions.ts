import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const cardSchema = z.object({
  uid: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  memberId: z.string().min(1).max(50),
  role: z.string().max(100),
  session: z.string().max(50),
});

function assertKey(key: string) {
  const expected = process.env.STUDIO_KEY;
  if (!expected || key !== expected) throw new Error("Unauthorized");
}

export const saveCards = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ key: z.string(), cards: z.array(cardSchema).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    assertKey(data.key);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let failed = 0;
    for (const c of data.cards) {
      try {
        await sql`
          insert into cards (uid, name, member_id, role, session)
          values (${c.uid}, ${c.name}, ${c.memberId}, ${c.role}, ${c.session})
          on conflict (uid) do update set
            name = excluded.name,
            member_id = excluded.member_id,
            role = excluded.role,
            session = excluded.session,
            updated_at = now()`;
      } catch {
        failed += 1;
      }
    }
    return { saved: data.cards.length - failed, failed };
  });

export const deleteCards = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ key: z.string(), uids: z.array(z.string()).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    assertKey(data.key);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from cards where uid = any(${data.uids})`;
    return { ok: true };
  });

export const getCard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ memberId: z.string().min(1).max(50) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ name: string; member_id: string; role: string; session: string }>`
      select name, member_id, role, session from cards
      where member_id = ${data.memberId} limit 1`;
    const r = rows[0];
    return r ? { name: r.name, memberId: r.member_id, role: r.role, session: r.session } : null;
  });

export const listCards = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ key: z.string() }).parse(data))
  .handler(async ({ data }) => {
    assertKey(data.key);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      uid: string;
      name: string;
      member_id: string;
      role: string;
      session: string;
    }>`select uid, name, member_id, role, session from cards`;
    return rows.map((r) => ({
      uid: r.uid,
      name: r.name,
      memberId: r.member_id,
      role: r.role,
      session: r.session,
    }));
  });
