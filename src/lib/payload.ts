export type CardPayload = {
  n: string;
  i: string;
  r: string;
  s: string;
};

export function encodePayload(payload: CardPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodePayload(raw: string): CardPayload | null {
  try {
    let b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as CardPayload;
    if (!parsed?.i) return null;
    return {
      n: String(parsed.n ?? ""),
      i: String(parsed.i),
      r: String(parsed.r ?? ""),
      s: String(parsed.s ?? ""),
    };
  } catch {
    return null;
  }
}

export function cardVerifyUrl(origin: string, payload: CardPayload): string {
  const token = encodePayload({ i: payload.i } as CardPayload);
  if (!origin) return `TECHCLUB|${payload.i}|${payload.n}`;
  return `${origin}/verify?p=${encodeURIComponent(token)}`;
}
