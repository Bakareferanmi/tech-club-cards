import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Output,
  Quality,
} from "mediabunny";
import { pickRecorderMime } from "@/lib/media/mime";
import { pickEncodeProfile } from "@/lib/media/codecs";

const DEMO_SECONDS = 4.2;
const DEMO_FPS = 24;
const DEMO_W = 960;
const DEMO_H = 540;

function pinkNoise(n: number): Float32Array {
  const out = new Float32Array(n);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

function makeNoisyVoice(sr = 48000): AudioBuffer {
  const n = Math.floor(DEMO_SECONDS * sr);
  const buf = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: sr });
  const data = buf.getChannelData(0);
  const pink = pinkNoise(n);

  const vowels = [
    { t0: 0.22, t1: 0.72, f0: 118, f1: 730, f2: 1090, f3: 2440 },
    { t0: 0.88, t1: 1.28, f0: 126, f1: 270, f2: 2290, f3: 3010 },
    { t0: 1.42, t1: 1.92, f0: 112, f1: 570, f2: 840, f3: 2410 },
    { t0: 2.08, t1: 2.55, f0: 108, f1: 300, f2: 870, f3: 2240 },
    { t0: 2.72, t1: 3.22, f0: 122, f1: 530, f2: 1840, f3: 2480 },
    { t0: 3.38, t1: 3.95, f0: 116, f1: 700, f2: 1220, f3: 2600 },
  ];

  let phase = 0;
  let y1 = 0,
    y1p = 0,
    y2 = 0,
    y2p = 0,
    y3 = 0,
    y3p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const v = vowels.find((x) => t >= x.t0 && t <= x.t1);
    let voice = 0;
    if (v) {
      const local = (t - v.t0) / (v.t1 - v.t0);
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, local)));
      const f0 = v.f0 * (1 + 0.03 * Math.sin(2 * Math.PI * 3.2 * t));
      phase += (2 * Math.PI * f0) / sr;
      const glottal = Math.max(0, Math.sin(phase)) ** 2.4;
      const res = (freq: number, bw: number, x: number, yn1: number, yn2: number) => {
        const r = Math.exp(-Math.PI * bw / sr);
        const a = 2 * r * Math.cos((2 * Math.PI * freq) / sr);
        const y = x + a * yn1 - r * r * yn2;
        return y;
      };
      const n1 = res(v.f1, 80, glottal, y1, y1p);
      y1p = y1;
      y1 = n1;
      const n2 = res(v.f2, 110, glottal, y2, y2p);
      y2p = y2;
      y2 = n2;
      const n3 = res(v.f3, 140, glottal, y3, y3p);
      y3p = y3;
      y3 = n3;
      voice = (0.5 * y1 + 0.3 * y2 + 0.16 * y3) * env * 0.08;
    } else {
      y1 *= 0.85;
      y2 *= 0.85;
      y3 *= 0.85;
    }


    const hum = 0.08 * Math.sin((2 * Math.PI * 60 * i) / sr) + 0.04 * Math.sin((2 * Math.PI * 120 * i) / sr);
    const room = pink[i]! * 0.55;
    const hiss = (Math.random() * 2 - 1) * 0.035;
    const clack =
      Math.abs(t - 1.15) < 0.04 || Math.abs(t - 2.85) < 0.035
        ? (Math.random() * 2 - 1) * 0.45 * Math.exp(-Math.abs(t - 1.15) * 40)
        : 0;
    data[i] = voice + room + hum + hiss + clack;
  }
  return buf;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  audio: AudioBuffer,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.fillStyle = "#121214";
  ctx.fillRect(0, 0, w, h);

  const ch = audio.getChannelData(0);
  const idx = Math.min(ch.length - 1, Math.floor(t * audio.sampleRate));
  let amp = 0;
  for (let i = 0; i < 256; i++) amp += Math.abs(ch[Math.min(ch.length - 1, idx + i)] ?? 0);
  amp /= 256;

  const cx = w * 0.5;
  const cy = h * 0.46;
  const radius = 70 + amp * 90;
  const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius * 2.4);
  g.addColorStop(0, "rgba(243,242,239,0.16)");
  g.addColorStop(1, "rgba(243,242,239,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(243,242,239,0.18)";
  ctx.lineWidth = 1.25;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, 36 + i * 28 + amp * 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(243,242,239,0.82)";
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + amp * 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(196,84,66,0.95)";
  ctx.beginPath();
  ctx.arc(36, 34, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(243,242,239,0.78)";
  ctx.font = "600 14px Poppins, sans-serif";
  ctx.fillText("REC  SAMPLE TAKE", 50, 39);

  ctx.fillStyle = "rgba(243,242,239,0.38)";
  ctx.font = "500 12px Poppins, sans-serif";
  ctx.fillText("Noisy room  ·  laptop mic", 36, h - 28);

  const bars = 48;
  const bw = (w - 72) / bars;
  const start = Math.max(0, idx - 2400);
  ctx.fillStyle = "rgba(243,242,239,0.22)";
  for (let i = 0; i < bars; i++) {
    let m = 0;
    const a = start + Math.floor((i / bars) * 2400);
    for (let j = 0; j < 40; j++) m = Math.max(m, Math.abs(ch[a + j] ?? 0));
    const bh = Math.max(2, m * 48);
    ctx.fillRect(36 + i * bw, h - 56 - bh, bw * 0.55, bh);
  }
}

export async function createNoisySample(): Promise<Blob> {
  const audio = makeNoisyVoice();
  try {
    return await encodeSampleWebCodecs(audio);
  } catch {
    return encodeSampleRecorder(audio);
  }
}

async function encodeSampleWebCodecs(audio: AudioBuffer): Promise<Blob> {
  const profile = await pickEncodeProfile(DEMO_W, DEMO_H, 1_200_000, 96_000);
  const canvas = document.createElement("canvas");
  canvas.width = DEMO_W;
  canvas.height = DEMO_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");

  const target = new BufferTarget();
  const output = new Output({ format: profile.format, target });
  const videoSource = new CanvasSource(canvas, {
    codec: profile.videoCodec,
    quality: new Quality({ bitrate: 1_200_000 }),
  });
  const audioSource = new AudioBufferSource({
    codec: profile.audioCodec,
    quality: new Quality({ bitrate: 96_000 }),
  });
  output.addVideoTrack(videoSource, { frameRate: DEMO_FPS });
  output.addAudioTrack(audioSource);
  await output.start();

  const frames = Math.round(DEMO_SECONDS * DEMO_FPS);
  const dt = 1 / DEMO_FPS;
  const videoWork = (async () => {
    for (let i = 0; i < frames; i++) {
      drawFrame(ctx, i * dt, audio);
      await videoSource.add(i * dt, dt);
    }
    videoSource.close();
  })();
  const audioWork = (async () => {
    await audioSource.add(audio);
    audioSource.close();
  })();
  await Promise.all([videoWork, audioWork]);
  await output.finalize();
  const buffer = target.buffer;
  if (!buffer) throw new Error("Sample encode failed");
  return new Blob([new Uint8Array(buffer)], { type: profile.mime });
}

async function encodeSampleRecorder(audio: AudioBuffer): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = DEMO_W;
  canvas.height = DEMO_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const stream = canvas.captureStream(DEMO_FPS);
  const actx = new AudioContext({ sampleRate: audio.sampleRate });
  const dest = actx.createMediaStreamDestination();
  const src = actx.createBufferSource();
  src.buffer = audio;
  src.connect(dest);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = pickRecorderMime();
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "video/webm" }));
  });
  rec.start();
  if (actx.state === "suspended") await actx.resume();
  src.start();
  const frames = Math.round(DEMO_SECONDS * DEMO_FPS);
  const dt = 1 / DEMO_FPS;
  await new Promise<void>((resolve) => {
    let i = 0;
    const tick = () => {
      drawFrame(ctx, i * dt, audio);
      i += 1;
      if (i >= frames) {
        resolve();
        return;
      }
      setTimeout(tick, dt * 1000);
    };
    tick();
  });
  rec.stop();
  src.stop();
  await actx.close();
  return done;
}
