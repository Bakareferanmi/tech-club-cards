import { deleteCards, saveCards } from "@/lib/cards.functions";
import type { Member } from "@/lib/club-store";

type Store = {
  getState: () => { members: Member[] };
  subscribe: (listener: (state: { members: Member[] }) => void) => () => void;
};

const KEY_STORAGE = "tech-club-studio-key";
let bound = false;
let disabled = false;

function studioKey(): string | null {
  let key = window.localStorage.getItem(KEY_STORAGE);
  if (!key) {
    key = window.prompt("Studio key (to save cards to the database)")?.trim() || null;
    if (key) window.localStorage.setItem(KEY_STORAGE, key);
    else disabled = true;
  }
  return key;
}

const sig = (m: Member) => JSON.stringify([m.name, m.memberId, m.role, m.session]);

export function bindCardSync(store: Store) {
  if (typeof window === "undefined" || bound) return;
  bound = true;
  const known = new Map<string, string>();
  let timer: number | undefined;

  async function flush() {
    if (disabled) return;
    const current = store.getState().members;
    const changed = current.filter((m) => known.get(m.uid) !== sig(m));
    const ids = new Set(current.map((m) => m.uid));
    const removed = [...known.keys()].filter((uid) => !ids.has(uid));
    if (!changed.length && !removed.length) return;
    const key = studioKey();
    if (!key) return;
    try {
      if (changed.length) {
        await saveCards({
          data: {
            key,
            cards: changed.map(({ uid, name, memberId, role, session }) => ({
              uid, name, memberId, role, session,
            })),
          },
        });
      }
      if (removed.length) await deleteCards({ data: { key, uids: removed } });
      for (const m of changed) known.set(m.uid, sig(m));
      for (const uid of removed) known.delete(uid);
    } catch (err) {
      if (String(err).includes("Unauthorized")) window.localStorage.removeItem(KEY_STORAGE);
      console.warn("[cards-sync] failed", err);
    }
  }

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void flush(), 800);
  };
  store.subscribe(schedule);
  schedule();
}
