import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HydrateClub } from "@/components/hydrate-club";
import { chunkMembers, PrintSheet } from "@/components/print-sheet";
import { Button } from "@/components/ui/button";
import { useClub } from "@/lib/club-store";
import { downloadDataUrl, elementToPng, safeFilePart } from "@/lib/export-card";
import { preloadSignatures } from "@/lib/signatures";
import { useOrigin } from "@/lib/use-origin";

export const Route = createFileRoute("/print")({ component: PrintRoute });

function PrintRoute() {
  return (
    <HydrateClub>
      <PrintStudio />
    </HydrateClub>
  );
}

function PrintStudio() {
  const origin = useOrigin();
  const members = useClub((s) => s.members);
  const pages = chunkMembers(members);
  const sheetRefs = useRef<Array<HTMLElement | null>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void preloadSignatures();
  }, []);

  async function downloadSheets() {
    if (members.length === 0) {
      toast.error("Add cards before exporting sheets.");
      return;
    }
    setSaving(true);
    try {
      for (let i = 0; i < pages.length; i++) {
        const el = sheetRefs.current[i];
        if (!el) continue;
        const png = await elementToPng(el, 2);
        downloadDataUrl(png, `tech-club-a4-${safeFilePart(String(i + 1))}.png`);
      }
      toast.success("A4 sheet PNGs saved — signatures included.");
    } catch {
      toast.error("Could not export the sheets.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="print-app">
      <div className="print-toolbar">
        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link to="/">
              <ArrowLeft />
              Studio
            </Link>
          </Button>
          <div>
            <p className="text-sm font-semibold text-navy">A4 print layout</p>
            <p className="text-xs text-muted">
              {members.length} {members.length === 1 ? "card" : "cards"} · {pages.length}{" "}
              {pages.length === 1 ? "page" : "pages"} · 8 per sheet · ID-1 size
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void downloadSheets()} disabled={saving}>
            <Download />
            {saving ? "Saving…" : "Download PNG sheets"}
          </Button>
          <Button onClick={() => window.print()} disabled={members.length === 0}>
            <Printer />
            Print
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="grid min-h-[60vh] place-items-center px-6 text-center">
          <div>
            <p className="font-display text-xl font-bold text-navy">No cards to print</p>
            <p className="mt-1 text-sm text-muted">Add members in the studio first.</p>
            <Button asChild className="mt-4">
              <Link to="/">Back to studio</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="print-stage">
          {pages.map((pageMembers, i) => (
            <PrintSheet
              key={`sheet-${i}`}
              ref={(node) => {
                sheetRefs.current[i] = node;
              }}
              members={pageMembers}
              origin={origin}
              pageNumber={i + 1}
              pageCount={pages.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
