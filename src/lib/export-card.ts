import { toPng } from "html-to-image";

async function waitForImages(el: HTMLElement) {
  const imgs = [...el.querySelectorAll("img")];
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return img.decode().catch(() => undefined);
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
  if (document.fonts?.ready) await document.fonts.ready;
}

export async function elementToPng(el: HTMLElement, pixelRatio = 4): Promise<string> {
  await waitForImages(el);
  return toPng(el, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: "#ffffff",
    skipAutoScale: true,
    style: {
      transform: "none",
    },
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "card";
}
