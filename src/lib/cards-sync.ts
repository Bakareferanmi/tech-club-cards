import { deleteCards, listCards, saveCards } from "@/lib/cards.functions";
import type { Member } from "@/lib/club-store";

type ClubView = { members: Member[]; selectedId: string | null };

type Store = {
  getState: () => ClubView;
  setState: (partial: Partial<ClubView>) => void;
  subscribe: (listener: (state: ClubView) => void) => () => void;
};

const KEY_STORAGE = "tech-club-studio-key";
const SYNCED_STORAGE = "tech-club-synced-uids";
const SEED_UID = "seed-bakare";
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

function readSynced(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SYNCED_STORAGE);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSynced(uids: Iterable<string>) {
  window.localStorage.setItem(SYNCED_STORAGE, JSON.stringify([...uids]));
}

const sig = (m: Member) => JSON.stringify([m.name, m.memberId, m.role, m.session]);

const idTail = (id: string) => {
  const m = /(\d+)\s*$/.exec(id.trim());
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};
const byMemberId = (a: Member, b: Member) =>
  idTail(a.memberId) - idTail(b.memberId) || a.memberId.localeCompare(b.memberId);

export function bindCardSync(store: Store) {
  if (typeof window === "undefined" || bound) return;
  bound = true;
  const known = new Map<string, string>();
  let timer: number | undefined;
  let pulled = false;

  async function pull() {
    const key = studioKey();
    if (!key) {
      pulled = true;
      return;
    }
    try {
      const remote: Member[] = await listCards({ data: { key } });
      const syncedBefore = readSynced();
      const remoteUids = new Set(remote.map((r) => r.uid));
      const local = store.getState().members;
      // keep only local cards the server doesn't know yet (new, unsynced ones)
      const localOnly = local.filter((m) => {
        if (remoteUids.has(m.uid)) return false; // server copy wins
        if (syncedBefore.has(m.uid)) return false; // was synced, deleted elsewhere
        if (m.uid === SEED_UID && remote.length > 0) return false; // stale starter card
        return true;
      });
      const merged = [...remote].sort(byMemberId).concat(localOnly);
      for (const m of remote) known.set(m.uid, sig(m));
      writeSynced(known.keys());
      const selected = store.getState().selectedId;
      store.setState({
        members: merged,
        selectedId: merged.some((m) => m.uid === selected) ? selected : (merged[0]?.uid ?? null),
      });
    } catch (err) {
      // never push local data if we couldn't read the server first
      disabled = true;
      if (String(err).includes("Unauthorized")) window.localStorage.removeItem(KEY_STORAGE);
      console.warn("[cards-sync] pull failed", err);
    } finally {
      pulled = true;
    }
  }

  async function flush() {
    if (disabled || !pulled) return;
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
      writeSynced(known.keys());
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
  void pull().then(schedule);
}
