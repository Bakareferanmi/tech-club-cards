import { create } from "zustand";
import { uid } from "@/lib/utils";

export type Member = {
  uid: string;
  name: string;
  memberId: string;
  role: string;
  session: string;
};

export const ROLES = [
  "Member",
  "President",
  "Vice President",
  "Secretary",
  "Treasurer",
  "Public Relations",
  "Head of Media",
  "Coordinator",
  "Mentor",
  "Head of Club",
  "General Manager",
] as const;

export const DEFAULT_SESSION = "2026 / 2027";

export const CARDS_PER_SECTION = 10;

export const SEED_MEMBER: Member = {
  uid: "seed-bakare",
  name: "Bakare Oluwaferanmi Pelumi",
  memberId: "001",
  role: "Member",
  session: DEFAULT_SESSION,
};

export function nextMemberId(ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    const match = /(\d+)\s*$/.exec(id.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1).padStart(3, "0");
}

export function sectionOf(memberId: string): number {
  const match = /(\d+)\s*$/.exec(memberId.trim());
  return match ? Math.floor((Number(match[1]) - 1) / CARDS_PER_SECTION) + 1 : 1;
}

type ClubState = {
  members: Member[];
  selectedId: string | null;
  defaultRole: string;
  defaultSession: string;
  select: (id: string | null) => void;
  addMember: (input: Omit<Member, "uid">) => Member;
  updateMember: (id: string, patch: Partial<Omit<Member, "uid">>) => void;
  removeMember: (id: string) => void;
  importMembers: (incoming: Omit<Member, "uid">[]) => number;
  applySessionToAll: (session: string) => void;
  setDefaults: (patch: { defaultRole?: string; defaultSession?: string }) => void;
  hydrate: (snapshot: ClubSnapshot) => void;
};

export type ClubSnapshot = {
  members: Member[];
  selectedId: string | null;
  defaultRole: string;
  defaultSession: string;
};

const STORAGE_KEY = "tech-club-cards-v1";

export const useClub = create<ClubState>((set, get) => ({
  members: [SEED_MEMBER],
  selectedId: SEED_MEMBER.uid,
  defaultRole: "Member",
  defaultSession: DEFAULT_SESSION,
  select: (id) => set({ selectedId: id }),
  addMember: (input) => {
    const member: Member = { ...input, uid: uid() };
    set({ members: [...get().members, member], selectedId: member.uid });
    return member;
  },
  updateMember: (id, patch) => {
    set({
      members: get().members.map((m) => (m.uid === id ? { ...m, ...patch } : m)),
    });
  },
  removeMember: (id) => {
    const members = get().members.filter((m) => m.uid !== id);
    const selectedId = get().selectedId === id ? (members[0]?.uid ?? null) : get().selectedId;
    set({ members, selectedId });
  },
  importMembers: (incoming) => {
    if (incoming.length === 0) return 0;
    const created = incoming.map((row) => ({ ...row, uid: uid() }));
    set({
      members: [...get().members, ...created],
      selectedId: created[created.length - 1]?.uid ?? get().selectedId,
    });
    return created.length;
  },
  applySessionToAll: (session) => {
    set({
      members: get().members.map((m) => ({ ...m, session })),
      defaultSession: session,
    });
  },
  setDefaults: (patch) => set(patch),
  hydrate: (snapshot) => set(snapshot),
}));

function snapshotOf(state: ClubState): ClubSnapshot {
  return {
    members: state.members,
    selectedId: state.selectedId,
    defaultRole: state.defaultRole,
    defaultSession: state.defaultSession,
  };
}

function isMember(value: unknown): value is Member {
  if (!value || typeof value !== "object") return false;
  const row = value as Member;
  return (
    typeof row.uid === "string" &&
    typeof row.name === "string" &&
    typeof row.memberId === "string" &&
    typeof row.role === "string" &&
    typeof row.session === "string"
  );
}

export function loadClubFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ClubSnapshot>;
    if (!Array.isArray(parsed.members) || !parsed.members.every(isMember)) return;
    useClub.getState().hydrate({
      members: parsed.members,
      selectedId: typeof parsed.selectedId === "string" || parsed.selectedId === null
        ? parsed.selectedId
        : parsed.members[0]?.uid ?? null,
      defaultRole: typeof parsed.defaultRole === "string" ? parsed.defaultRole : "Member",
      defaultSession:
        typeof parsed.defaultSession === "string" ? parsed.defaultSession : DEFAULT_SESSION,
    });
  } catch {
    // ignore bad local data
  }
}

export function bindClubPersistence() {
  if (typeof window === "undefined") return () => undefined;
  loadClubFromStorage();
  return useClub.subscribe((state) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotOf(state)));
  });
}

export function parseBulkText(
  text: string,
  fallbackRole: string,
  fallbackSession: string,
  existingIds: string[],
): Omit<Member, "uid">[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]?.toLowerCase() ?? "";
  const start = header.startsWith("name") ? 1 : 0;
  const used = new Set(existingIds.map((id) => id.toUpperCase()));
  const rows: Omit<Member, "uid">[] = [];

  for (const line of lines.slice(start)) {
    const parts = splitCsvLine(line);
    const name = (parts[0] ?? "").trim();
    if (!name) continue;
    let memberId = (parts[1] ?? "").trim();
    const role = (parts[2] ?? "").trim() || fallbackRole;
    const session = (parts[3] ?? "").trim() || fallbackSession;
    if (!memberId) {
      memberId = nextMemberId([...used, ...rows.map((r) => r.memberId)]);
    }
    used.add(memberId.toUpperCase());
    rows.push({ name, memberId, role, session });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  if (!line.includes(",")) return [line];
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}
