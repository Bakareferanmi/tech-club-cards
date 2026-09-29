export const SIGNATURE_FILES = {
  gm: "/signatures/gm.png",
  headOfClub: "/signatures/head-of-club.png",
  principal: "/signatures/principal.png",
} as const;

const cache = new Map<string, string>();

export async function toDataUrl(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return hit;
  const res = await fetch(src);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  cache.set(src, dataUrl);
  return dataUrl;
}

export async function preloadSignatures() {
  await Promise.all(Object.values(SIGNATURE_FILES).map((src) => toDataUrl(src)));
}
