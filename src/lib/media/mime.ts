export function pickRecorderMime(): string {
  const types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export function even(n: number): number {
  const r = Math.max(2, Math.round(n));
  return r % 2 === 0 ? r : r + 1;
}

export function fitHeight(width: number, height: number, maxHeight: number): { width: number; height: number } {
  if (height <= 0 || width <= 0) return { width: even(1280), height: even(Math.min(720, maxHeight)) };
  const scale = Math.min(1, maxHeight / height);
  return { width: even(width * scale), height: even(height * scale) };
}
