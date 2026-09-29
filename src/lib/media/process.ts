import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Output,
  Quality,
} from "mediabunny";
import { cleanAudioBuffer, concatAudioBuffers, mixToMono } from "@/lib/audio/clean-audio";
import { even, fitHeight, pickRecorderMime } from "@/lib/media/mime";
import { pickEncodeProfile } from "@/lib/media/codecs";
import { PRESETS, type SizePreset } from "@/lib/media/presets";

export type ProcessStage = "read" | "voice" | "picture" | "pack";

export type ProcessProgress = {
  stage: ProcessStage;
  progress: number;
};

export type ProcessResult = {
  blob: Blob;
  filename: string;
  mime: string;
  originalBytes: number;
  cleanedBytes: number;
  duration: number;
  width: number;
  height: number;
  originalAudio: AudioBuffer | null;
  cleanedAudio: AudioBuffer | null;
};

function stageProgress(stage: ProcessStage, local: number): ProcessProgress {
  const spans: Record<ProcessStage, [number, number]> = {
    read: [0, 0.12],
    voice: [0.12, 0.48],
    picture: [0.48, 0.92],
    pack: [0.92, 1],
  };
  const [a, b] = spans[stage];
  return { stage, progress: a + Math.min(1, Math.max(0, local)) * (b - a) };
}

export async function processClip(options: {
  blob: Blob;
  intensity: number;
  preset: SizePreset;
  onProgress?: (p: ProcessProgress) => void;
}): Promise<ProcessResult> {
  const { blob, intensity, preset, onProgress } = options;
  const cfg = PRESETS[preset];
  const notify = (stage: ProcessStage, local: number) => onProgress?.(stageProgress(stage, local));

  notify("read", 0.05);
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error("That file doesn’t include a picture track. Try a video clip.");
    }
    if (!(await videoTrack.canDecode())) {
      throw new Error("This browser can’t decode that video codec.");
    }

    const duration =
      (await input.getDurationFromMetadata()) ?? (await input.computeDuration()) ?? 0;
    const displayW = await videoTrack.getDisplayWidth();
    const displayH = await videoTrack.getDisplayHeight();
    const fitted = fitHeight(displayW, displayH, cfg.height);
    notify("read", 1);

    notify("voice", 0);
    const originalAudio = await decodeAudio(input);
    let cleanedAudio: AudioBuffer | null = null;
    if (originalAudio) {
      cleanedAudio = await cleanAudioBuffer(originalAudio, intensity, (r) => notify("voice", r));
      if (cfg.channels === 1 && cleanedAudio.numberOfChannels > 1) {
        cleanedAudio = mixToMono(cleanedAudio);
      }
    }
    notify("voice", 1);

    notify("picture", 0);
    let outBlob: Blob;
    let mime: string;
    let extension: "mp4" | "webm";
    try {
      const encoded = await encodeWithMediabunny({
        input,
        cleanedAudio,
        width: fitted.width,
        height: fitted.height,
        videoBitrate: cfg.videoBitrate,
        audioBitrate: cfg.audioBitrate,
        onProgress: (r) => notify("picture", r),
      });
      outBlob = encoded.blob;
      mime = encoded.mime;
      extension = encoded.extension;
    } catch (err) {
      console.warn("WebCodecs encode failed, using recorder fallback", err);
      const fallback = await encodeWithRecorder({
        source: blob,
        cleanedAudio,
        width: fitted.width,
        height: fitted.height,
        videoBitrate: cfg.videoBitrate,
        audioBitrate: cfg.audioBitrate,
        onProgress: (r) => notify("picture", r),
      });
      outBlob = fallback.blob;
      mime = fallback.mime;
      extension = fallback.extension;
    }

    notify("pack", 1);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return {
      blob: outBlob,
      filename: `cleartake-${stamp}.${extension}`,
      mime,
      originalBytes: blob.size,
      cleanedBytes: outBlob.size,
      duration,
      width: fitted.width,
      height: fitted.height,
      originalAudio,
      cleanedAudio,
    };
  } finally {
    input.dispose();
  }
}

async function decodeAudio(input: Input): Promise<AudioBuffer | null> {
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  if (!(await track.canDecode())) return null;
  const sink = new AudioBufferSink(track);
  const chunks: AudioBuffer[] = [];
  for await (const wrapped of sink.buffers()) {
    chunks.push(wrapped.buffer);
  }
  if (chunks.length === 0) return null;
  return concatAudioBuffers(chunks);
}

async function encodeWithMediabunny(args: {
  input: Input;
  cleanedAudio: AudioBuffer | null;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  onProgress: (r: number) => void;
}): Promise<{ blob: Blob; mime: string; extension: "mp4" | "webm" }> {
  const profile = await pickEncodeProfile(args.width, args.height, args.videoBitrate, args.audioBitrate);
  const target = new BufferTarget();
  const output = new Output({
    format: profile.format,
    target,
  });

  const conversion = await Conversion.init({
    input: args.input,
    output,
    tracks: "primary",
    composable: true,
    copy: false,
    showWarnings: false,
    video: {
      height: args.height,
      codec: profile.videoCodec,
      quality: new Quality({ bitrate: args.videoBitrate, bitrateMode: "variable" }),
      forceTranscode: true,
    },
    audio: { discard: true },
  });

  if (!conversion.isValid) {
    const why = conversion.discardedTracks.map((t) => t.reason).join(", ") || "unknown";
    throw new Error(`Couldn’t prepare the picture track (${why}).`);
  }

  conversion.onProgress = (progress) => args.onProgress(progress);

  output.setMetadataTags({});

  if (args.cleanedAudio) {
    const audioSource = new AudioBufferSource({
      codec: profile.audioCodec,
      quality: new Quality({ bitrate: args.audioBitrate, bitrateMode: "variable" }),
    });
    output.addAudioTrack(audioSource);
    await output.start();
    await Promise.all([
      conversion.execute(),
      (async () => {
        await audioSource.add(args.cleanedAudio!);
        audioSource.close();
      })(),
    ]);
    await output.finalize();
  } else {
    await output.start();
    await conversion.execute();
    await output.finalize();
  }

  const buffer = target.buffer;
  if (!buffer) throw new Error("Encoding finished without a file.");
  return {
    blob: new Blob([new Uint8Array(buffer)], { type: profile.mime }),
    mime: profile.mime,
    extension: profile.extension,
  };
}

async function encodeWithRecorder(args: {
  source: Blob;
  cleanedAudio: AudioBuffer | null;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  onProgress: (r: number) => void;
}): Promise<{ blob: Blob; mime: string; extension: "mp4" | "webm" }> {
  const url = URL.createObjectURL(args.source);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  await wait(video, "loadeddata");

  const canvas = document.createElement("canvas");
  canvas.width = even(args.width);
  canvas.height = even(args.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t open a drawing surface.");

  const stream = canvas.captureStream(30);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  let sourceNode: AudioBufferSourceNode | null = null;
  if (args.cleanedAudio) {
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = args.cleanedAudio;
    sourceNode.connect(dest);
  }
  for (const track of dest.stream.getAudioTracks()) {
    stream.addTrack(track);
  }

  const mime = pickRecorderMime();
  const rec = new MediaRecorder(stream, {
    mimeType: mime || undefined,
    videoBitsPerSecond: args.videoBitrate,
    audioBitsPerSecond: args.audioBitrate,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    rec.onerror = () => reject(new Error("Couldn’t compress this clip."));
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }));
  });

  rec.start(250);
  if (audioCtx.state === "suspended") await audioCtx.resume();
  sourceNode?.start(0);
  await video.play();

  await new Promise<void>((resolve) => {
    const draw = () => {
      if (video.ended || video.paused) {
        resolve();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const d = video.duration || 1;
      args.onProgress(Math.min(1, video.currentTime / d));
      requestAnimationFrame(draw);
    };
    draw();
    video.onended = () => resolve();
  });

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  rec.stop();
  const blob = await stopped;
  sourceNode?.stop();
  await audioCtx.close();
  URL.revokeObjectURL(url);
  video.src = "";
  const extension = blob.type.includes("mp4") ? "mp4" : "webm";
  return { blob, mime: blob.type || "video/webm", extension };
}

function wait(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      el.removeEventListener("error", bad);
      resolve();
    };
    const bad = () => {
      el.removeEventListener(event, ok);
      reject(new Error("Couldn’t read that video."));
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });
}
