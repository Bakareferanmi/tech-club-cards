import { Link } from "@tanstack/react-router";
import {
  Download,
  LayoutGrid,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { AccessCard } from "@/components/access-card";
import { CardStage } from "@/components/card-stage";
import { CodeBracketsIcon } from "@/components/card-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  nextMemberId,
  parseBulkText,
  ROLES,
  useClub,
  type Member,
} from "@/lib/club-store";
import { downloadDataUrl, elementToPng, safeFilePart } from "@/lib/export-card";
import { cardVerifyUrl } from "@/lib/payload";
import { preloadSignatures } from "@/lib/signatures";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";

type Draft = Omit<Member, "uid">;

function memberToDraft(member: Member): Draft {
  return {
    name: member.name,
    memberId: member.memberId,
    role: member.role,
    session: member.session,
  };
}

export function Studio() {
  const origin = useOrigin();
  const members = useClub((s) => s.members);
  const selectedId = useClub((s) => s.selectedId);
  const select = useClub((s) => s.select);
  const defaultRole = useClub((s) => s.defaultRole);
  const defaultSession = useClub((s) => s.defaultSession);
  const selected = selectedId ? (members.find((m) => m.uid === selectedId) ?? null) : null;
  const exportRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState<Draft>(() =>
    selected
      ? memberToDraft(selected)
      : {
          name: "",
          memberId: nextMemberId(members.map((m) => m.memberId)),
          role: defaultRole,
          session: defaultSession,
        },
  );

  useEffect(() => {
    void preloadSignatures();
  }, []);

  useEffect(() => {
    if (selected) setDraft(memberToDraft(selected));
  }, [selected]);

  const preview = useMemo(
    () => ({
      name: draft.name,
      memberId: draft.memberId,
      role: draft.role,
      session: draft.session,
      verifyUrl: cardVerifyUrl(origin, {
        n: draft.name || "Member Name",
        i: draft.memberId || "TECH0000",
        r: draft.role || "Member",
        s: draft.session || defaultSession,
      }),
    }),
    [defaultSession, draft, origin],
  );

  async function downloadCard() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const png = await elementToPng(exportRef.current, 4);
      downloadDataUrl(png, `tech-club-${safeFilePart(draft.memberId || "card")}.png`);
      toast.success("Card PNG saved — signatures included.");
    } catch {
      toast.error("Could not export this card. Try again.");
    } finally {
      setExporting(false);
    }
  }

  function startNew() {
    select(null);
    setDraft({
      name: "",
      memberId: nextMemberId(members.map((m) => m.memberId)),
      role: defaultRole,
      session: defaultSession,
    });
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-fg">
              <CodeBracketsIcon className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold tracking-tight text-navy">
                TECH <span className="text-primary">CLUB</span>
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Access card studio</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-muted">
              {members.length} {members.length === 1 ? "card" : "cards"} · 10 / A4
            </span>
            <BulkDialog />
            <Button asChild variant="secondary">
              <Link to="/scan">
                <ScanLine />
                Scan card
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/print">
                <LayoutGrid />
                Print A4 sheets
              </Link>
            </Button>
            <Button onClick={() => void downloadCard()} disabled={exporting}>
              <Download />
              {exporting ? "Saving…" : "Download PNG"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start sm:px-6">
        <section className="space-y-4">
          <MemberForm
            draft={draft}
            setDraft={setDraft}
            selected={selected}
            onStartNew={startNew}
          />
          <Roster members={members} selectedId={selected?.uid ?? null} />
        </section>

        <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-navy">Live card</h2>
              <p className="text-sm text-muted">
                Matches the print layout. Official signatures stay on every export.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/print">
                <Printer />
                A4 preview
              </Link>
            </Button>
          </div>

          <CardStage>
            <AccessCard data={preview} />
          </CardStage>
        </section>
      </main>

      <div className="export-offscreen" aria-hidden="true">
        <AccessCard ref={exportRef} data={preview} />
      </div>
    </div>
  );
}

function MemberForm({
  draft,
  setDraft,
  selected,
  onStartNew,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  selected: Member | null;
  onStartNew: () => void;
}) {
  const addMember = useClub((s) => s.addMember);
  const updateMember = useClub((s) => s.updateMember);
  const members = useClub((s) => s.members);
  const defaultSession = useClub((s) => s.defaultSession);
  const editing = Boolean(selected);

  function patch(partial: Partial<Draft>) {
    setDraft({ ...draft, ...partial });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.name.trim();
    if (!trimmed) {
      toast.error("Add a member name first.");
      return;
    }
    const card = {
      name: trimmed,
      memberId: draft.memberId.trim() || nextMemberId(members.map((m) => m.memberId)),
      role: draft.role.trim() || "Member",
      session: draft.session.trim() || defaultSession,
    };
    if (selected) {
      updateMember(selected.uid, card);
      toast.success("Card updated.");
    } else {
      addMember(card);
      toast.success("Card added to the roster.");
      setDraft({
        name: "",
        memberId: nextMemberId([...members.map((m) => m.memberId), card.memberId]),
        role: card.role,
        session: card.session,
      });
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy">
          {editing ? "Edit card" : "New card"}
        </h2>
        {editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={onStartNew}>
            <Plus />
            New
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3">
        <Field label="Full name">
          <Input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Bakare Oluwaferanmi Pelumi"
            autoComplete="name"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID">
            <Input
              value={draft.memberId}
              onChange={(e) => patch({ memberId: e.target.value.toUpperCase() })}
              placeholder="TECH1234"
            />
          </Field>
          <Field label="Role">
            <select
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              value={draft.role}
              onChange={(e) => patch({ role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              {draft.role && !(ROLES as readonly string[]).includes(draft.role) ? (
                <option value={draft.role}>{draft.role}</option>
              ) : null}
            </select>
          </Field>
        </div>
        <Field label="Session">
          <Input value={draft.session} onChange={(e) => patch({ session: e.target.value })} />
        </Field>
        <Button type="submit" className="mt-1 w-full">
          {editing ? "Save card" : "Add card"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Roster({
  members,
  selectedId,
}: {
  members: Member[];
  selectedId: string | null;
}) {
  const select = useClub((s) => s.select);
  const removeMember = useClub((s) => s.removeMember);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-navy">Roster</h2>
        <span className="text-xs text-muted">{members.length}</span>
      </div>
      {members.length === 0 ? (
        <p className="rounded-xl bg-paper px-3 py-6 text-center text-sm text-muted">
          No cards yet. Add a name to print the first sheet.
        </p>
      ) : (
        <ul className="grid max-h-[28rem] gap-2 overflow-auto pr-1">
          {members.map((m) => {
            const active = m.uid === selectedId;
            return (
              <li key={m.uid}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2 py-1.5",
                    active ? "border-primary bg-paper" : "border-border bg-surface",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => select(m.uid)}
                    className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-navy">{m.name}</p>
                    <p className="truncate text-xs text-muted">
                      {m.memberId} · {m.role}
                    </p>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => select(m.uid)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => {
                      removeMember(m.uid);
                      toast("Card removed.");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BulkDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const members = useClub((s) => s.members);
  const defaultRole = useClub((s) => s.defaultRole);
  const defaultSession = useClub((s) => s.defaultSession);
  const importMembers = useClub((s) => s.importMembers);

  function importNow() {
    const rows = parseBulkText(
      text,
      defaultRole,
      defaultSession,
      members.map((m) => m.memberId),
    );
    if (rows.length === 0) {
      toast.error("Paste at least one name.");
      return;
    }
    const n = importMembers(rows);
    toast.success(`${n} ${n === 1 ? "card" : "cards"} added.`);
    setText("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Upload />
          Bulk add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add many cards</DialogTitle>
          <DialogDescription>
            One name per line. Optional CSV: name, ID, role, session.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Adaeze Okonkwo\nIbrahim Musa, TECH1240, President\nSofia Chen"}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={importNow}>
            Add to roster
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
