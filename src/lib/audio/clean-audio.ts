import { fft, hann } from "./fft";

const FFT_SIZE = 2048;
const HOP = 512;

type Biquad = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  z1: number;
  z2: number;
};

function biquad(): Biquad {
  return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0, z1: 0, z2: 0 };
}

function tick(f: Biquad, x: number): number {
  const y = f.b0 * x + f.z1;
  f.z1 = f.b1 * x - f.a1 * y + f.z2;
  f.z2 = f.b2 * x - f.a2 * y;
  return y;
}

function setHighpass(f: Biquad, freq: number, q: number, sr: number): void {
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const b0 = (1 + cos) / 2;
  const b1 = -(1 + cos);
  const b2 = (1 + cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  f.b0 = b0 / a0;
  f.b1 = b1 / a0;
  f.b2 = b2 / a0;
  f.a1 = a1 / a0;
  f.a2 = a2 / a0;
}

function setLowpass(f: Biquad, freq: number, q: number, sr: number): void {
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const b0 = (1 - cos) / 2;
  const b1 = 1 - cos;
  const b2 = (1 - cos) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  f.b0 = b0 / a0;
  f.b1 = b1 / a0;
  f.b2 = b2 / a0;
  f.a1 = a1 / a0;
  f.a2 = a2 / a0;
}

function setPeaking(f: Biquad, freq: number, q: number, gainDb: number, sr: number): void {
  const a = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const b0 = 1 + alpha * a;
  const b1 = -2 * cos;
  const b2 = 1 - alpha * a;
  const a0 = 1 + alpha / a;
  const a1 = -2 * cos;
  const a2 = 1 - alpha / a;
  f.b0 = b0 / a0;
  f.b1 = b1 / a0;
  f.b2 = b2 / a0;
  f.a1 = a1 / a0;
  f.a2 = a2 / a0;
}

function setLowShelf(f: Biquad, freq: number, gainDb: number, sr: number): void {
  const a = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const s = 1;
  const beta = Math.sqrt(a) / s;
  const b0 = a * (a + 1 - (a - 1) * cos + beta * sin);
  const b1 = 2 * a * (a - 1 - (a + 1) * cos);
  const b2 = a * (a + 1 - (a - 1) * cos - beta * sin);
  const a0 = a + 1 + (a - 1) * cos + beta * sin;
  const a1 = -2 * (a - 1 + (a + 1) * cos);
  const a2 = a + 1 + (a - 1) * cos - beta * sin;
  f.b0 = b0 / a0;
  f.b1 = b1 / a0;
  f.b2 = b2 / a0;
  f.a1 = a1 / a0;
  f.a2 = a2 / a0;
}

function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

function linToDb(x: number): number {
  return 20 * Math.log10(Math.max(x, 1e-12));
}

function yieldSlice(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function spectralReduce(channel: Float32Array, intensity: number, onChunk?: () => void): Float32Array {
  const n = channel.length;
  const win = hann(FFT_SIZE);
  const hop = HOP;
  const frameCount = Math.max(1, Math.floor((n - FFT_SIZE) / hop) + 1);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const mag = new Float32Array(FFT_SIZE / 2);
  const noise = new Float32Array(FFT_SIZE / 2);
  const noiseN = new Float32Array(FFT_SIZE / 2);
  const prevGain = new Float32Array(FFT_SIZE / 2);
  prevGain.fill(1);

  const rms = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    const off = f * hop;
    let e = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = (channel[off + i] ?? 0) * win[i]!;
      e += s * s;
    }
    rms[f] = Math.sqrt(e / FFT_SIZE);
  }

  const sorted = Array.from(rms).sort((a, b) => a - b);
  const quietThresh = sorted[Math.max(0, Math.floor(sorted.length * 0.18))] ?? 0.002;
  const noiseCap = Math.max(quietThresh * 1.6, 1e-4);

  for (let f = 0; f < frameCount; f++) {
    if (rms[f]! > noiseCap) continue;
    const off = f * hop;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < FFT_SIZE; i++) re[i] = (channel[off + i] ?? 0) * win[i]!;
    fft(re, im, false);
    for (let k = 0; k < mag.length; k++) {
      const p = re[k]! * re[k]! + im[k]! * im[k]!;
      noise[k] += p;
      noiseN[k] += 1;
    }
  }

  for (let k = 0; k < noise.length; k++) {
    noise[k] = noiseN[k]! > 2 ? noise[k]! / noiseN[k]! : 1e-8;
  }

  if (noiseN[10]! < 3) {
    // No quiet stretch — take the quietest 12% of frames.
    const order = Array.from(rms.keys()).sort((a, b) => rms[a]! - rms[b]!);
    const take = Math.max(4, Math.floor(frameCount * 0.12));
    noise.fill(0);
    for (let t = 0; t < take; t++) {
      const f = order[t]!;
      const off = f * hop;
      re.fill(0);
      im.fill(0);
      for (let i = 0; i < FFT_SIZE; i++) re[i] = (channel[off + i] ?? 0) * win[i]!;
      fft(re, im, false);
      for (let k = 0; k < mag.length; k++) {
        noise[k] += re[k]! * re[k]! + im[k]! * im[k]!;
      }
    }
    for (let k = 0; k < noise.length; k++) noise[k]! /= take;
  }

  const oversub = 1.15 + 2.35 * intensity;
  const floor = 0.11 - 0.07 * intensity;
  const out = new Float32Array(n + FFT_SIZE);
  const ola = new Float32Array(n + FFT_SIZE);

  const bins = mag.length;
  const tmpGain = new Float32Array(bins);

  for (let f = 0; f < frameCount; f++) {
    const off = f * hop;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < FFT_SIZE; i++) re[i] = (channel[off + i] ?? 0) * win[i]!;
    fft(re, im, false);

    for (let k = 0; k < bins; k++) {
      const p = re[k]! * re[k]! + im[k]! * im[k]!;
      const nPsd = noise[k]! + 1e-12;
      const post = p / nPsd;
      const wiener = post / (post + 1);
      const sub = 1 - (oversub * nPsd) / (p + 1e-12);
      let g = Math.max(floor, Math.min(wiener, Math.max(sub, floor)));
      const kHzHint = k / bins;
      if (kHzHint > 0.02 && kHzHint < 0.18) g = Math.min(1, g + 0.08 * intensity);
      tmpGain[k] = g;
    }

    // 3-bin frequency smooth
    for (let k = 1; k < bins - 1; k++) {
      tmpGain[k] = tmpGain[k - 1]! * 0.2 + tmpGain[k]! * 0.6 + tmpGain[k + 1]! * 0.2;
    }

    for (let k = 0; k < bins; k++) {
      const g = tmpGain[k]!;
      const prev = prevGain[k]!;
      const smoothed = g < prev ? 0.55 * g + 0.45 * prev : 0.18 * g + 0.82 * prev;
      prevGain[k] = smoothed;
      const applied = 1 - intensity + intensity * smoothed;
      re[k]! *= applied;
      im[k]! *= applied;
      if (k > 0 && k < bins) {
        const mir = FFT_SIZE - k;
        if (mir < FFT_SIZE && mir !== k) {
          re[mir]! *= applied;
          im[mir]! *= applied;
        }
      }
    }

    fft(re, im, true);
    for (let i = 0; i < FFT_SIZE; i++) {
      out[off + i]! += re[i]! * win[i]!;
      ola[off + i]! += win[i]! * win[i]!;
    }

    if (onChunk && (f & 63) === 0) onChunk();
  }

  const cleaned = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const w = ola[i]!;
    cleaned[i] = w > 1e-6 ? out[i]! / w : channel[i]!;
  }
  return cleaned;
}

function colorBluetooth(channel: Float32Array, sr: number, intensity: number): void {
  const hpf = biquad();
  const shelf = biquad();
  const presence = biquad();
  const presence2 = biquad();
  const deess = biquad();
  const airCut = biquad();

  const hpHz = 70 + 45 * intensity;
  setHighpass(hpf, hpHz, 0.72, sr);
  setLowShelf(shelf, 190, 1.1 + 0.6 * intensity, sr);
  setPeaking(presence, 2650, 1.15, 2.4 + 3.2 * intensity, sr);
  setPeaking(presence2, 4800, 1.35, 1.1 + 1.6 * intensity, sr);
  setPeaking(deess, 7400, 1.8, -1.4 - 1.8 * intensity, sr);
  setLowpass(airCut, 11800 - 1800 * intensity, 0.707, sr);

  const threshDb = -24 + 4 * (1 - intensity);
  const ratio = 1.7 + 2.4 * intensity;
  const gateDb = -46 + 8 * intensity;
  const attack = Math.exp(-1 / (0.008 * sr));
  const release = Math.exp(-1 / (0.09 * sr));
  const gateAttack = Math.exp(-1 / (0.012 * sr));
  const gateRelease = Math.exp(-1 / (0.14 * sr));
  const makeup = dbToGain(2.5 + 3.5 * intensity);

  let env = 0;
  let gateEnv = 0;

  for (let i = 0; i < channel.length; i++) {
    let x = channel[i]!;
    x = tick(hpf, x);
    x = tick(shelf, x);
    x = tick(presence, x);
    x = tick(presence2, x);
    x = tick(deess, x);
    x = tick(airCut, x);

    const abs = Math.abs(x);
    const ac = abs > env ? attack : release;
    env = ac * env + (1 - ac) * abs;
    const envDb = linToDb(env);

    let gainDb = 0;
    if (envDb > threshDb) {
      gainDb = (threshDb - envDb) * (1 - 1 / ratio);
    }

    const gc = abs > gateEnv ? gateAttack : gateRelease;
    gateEnv = gc * gateEnv + (1 - gc) * abs;
    const gDb = linToDb(gateEnv);
    if (gDb < gateDb) {
      gainDb += (gDb - gateDb) * (1.2 + 1.4 * intensity);
    }

    x *= dbToGain(gainDb) * makeup;
    channel[i] = x;
  }
}

function limitAndNormalize(channels: Float32Array[], ceilingDb = -1.1): void {
  let peak = 1e-9;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]!);
      if (a > peak) peak = a;
    }
  }
  const ceiling = dbToGain(ceilingDb);
  const scale = ceiling / peak;
  const knee = 0.92;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      let x = ch[i]! * scale;
      const a = Math.abs(x);
      if (a > knee) {
        const y = knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee + 1e-6));
        x = Math.sign(x) * y;
      }
      ch[i] = x;
    }
  }
}

export type CleanProgress = (ratio: number) => void;

export async function cleanAudioBuffer(
  input: AudioBuffer,
  intensity: number,
  onProgress?: CleanProgress,
): Promise<AudioBuffer> {
  const amount = Math.min(1, Math.max(0, intensity));
  const sr = input.sampleRate;
  const length = input.length;
  const channelCount = input.numberOfChannels;
  const copies: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    copies.push(new Float32Array(input.getChannelData(c)));
  }

  const nFrames = Math.max(1, Math.floor((length - FFT_SIZE) / HOP) + 1);
  let doneFrames = 0;

  for (let c = 0; c < copies.length; c++) {
    const reduced = spectralReduce(copies[c]!, amount, () => {
      doneFrames += 64;
      onProgress?.(Math.min(0.82, (doneFrames / (nFrames * copies.length)) * 0.82));
    });
    copies[c] = reduced;
    colorBluetooth(copies[c]!, sr, amount);
    await yieldSlice();
  }

  limitAndNormalize(copies);
  onProgress?.(1);

  const out = new AudioBuffer({
    length,
    numberOfChannels: channelCount,
    sampleRate: sr,
  });
  for (let c = 0; c < channelCount; c++) {
    out.getChannelData(c).set(copies[c]!);
  }
  return out;
}

export function mixToMono(buffer: AudioBuffer): AudioBuffer {
  if (buffer.numberOfChannels === 1) return buffer;
  const out = new AudioBuffer({
    length: buffer.length,
    numberOfChannels: 1,
    sampleRate: buffer.sampleRate,
  });
  const dst = out.getChannelData(0);
  const n = buffer.numberOfChannels;
  for (let i = 0; i < buffer.length; i++) {
    let s = 0;
    for (let c = 0; c < n; c++) s += buffer.getChannelData(c)[i]!;
    dst[i] = s / n;
  }
  return out;
}

export function computePeaks(buffer: AudioBuffer, bars = 112): number[] {
  const mix = buffer.numberOfChannels === 1 ? buffer.getChannelData(0) : mixToMono(buffer).getChannelData(0);
  const size = Math.max(1, Math.floor(mix.length / bars));
  const peaks = new Array<number>(bars);
  let max = 1e-6;
  for (let i = 0; i < bars; i++) {
    let m = 0;
    const start = i * size;
    for (let j = 0; j < size; j++) {
      const a = Math.abs(mix[start + j] ?? 0);
      if (a > m) m = a;
    }
    peaks[i] = m;
    if (m > max) max = m;
  }
  return peaks.map((p) => p / max);
}

export function concatAudioBuffers(chunks: AudioBuffer[]): AudioBuffer {
  if (chunks.length === 0) {
    return new AudioBuffer({ length: 1, numberOfChannels: 1, sampleRate: 48000 });
  }
  if (chunks.length === 1) return chunks[0]!;
  const sampleRate = chunks[0]!.sampleRate;
  const channels = Math.max(...chunks.map((c) => c.numberOfChannels));
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const out = new AudioBuffer({ length, numberOfChannels: channels, sampleRate });
  let offset = 0;
  for (const chunk of chunks) {
    for (let c = 0; c < channels; c++) {
      const src = chunk.getChannelData(Math.min(c, chunk.numberOfChannels - 1));
      out.getChannelData(c).set(src, offset);
    }
    offset += chunk.length;
  }
  return out;
}
