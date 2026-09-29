import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  SwitchCamera,


  LoaderCircle,
  Mic,
  Pause,
  Play,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mark } from "@/components/mark";
import { Waveform } from "@/components/waveform";
import { computePeaks } from "@/lib/audio/clean-audio";
import { PRESETS, PRESET_ORDER, type SizePreset } from "@/lib/media/presets";
import { cameraErrorMessage, openCamera, startRecording, stopStream, type Facing } from "@/lib/media/record";
import { cn, formatBytes, formatDuration, formatPct } from "@/lib/utils";
import type { ProcessStage } from "@/lib/media/process";

type Phase = "idle" | "live" | "recording" | "processing" | "ready";
type Compare = "original" | "cleaned";

const STAGE_LABEL: Record<ProcessStage, string> = {
  read: "Reading clip",
  voice: "Cleaning voice",
  picture: "Shrinking picture",
  pack: "Packing file",
};

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/*";

export function Studio() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [facing, setFacing] = useState<Facing>("user");
  const [preset, setPreset] = useState<SizePreset>("balanced");
  const [intensity, setIntensity] = useState(72);
  const [elapsed, setElapsed] = useState(0);
  const [compare, setCompare] = useState<Compare>("cleaned");
  const [playing, setPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<ProcessStage>("read");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [originalPeaks, setOriginalPeaks] = useState<number[]>([]);
  const [cleanedPeaks, setCleanedPeaks] = useState<number[]>([]);
  const [result, setResult] = useState<{
    filename: string;
    originalBytes: number;
    cleanedBytes: number;
    duration: number;
    blob: Blob;
  } | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const origVideoRef = useRef<HTMLVideoElement>(null);
  const cleanVideoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<ReturnType<typeof startRecording> | null>(null);
  const originalBlobRef = useRef<Blob | null>(null);
  const urlsRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  const rememberUrl = (url: string) => {
    urlsRef.current.push(url);
    return url;
  };

  const revokeAll = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  };

  const resetMedia = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    originalBlobRef.current = null;
    revokeAll();
    setOriginalUrl(null);
    setCleanedUrl(null);
    setResult(null);
    setOriginalPeaks([]);
    setCleanedPeaks([]);
    setPlayProgress(0);
    setPlaying(false);
    setError(null);
    setElapsed(0);
  }, []);

  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      revokeAll();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const runProcess = useCallback(
    async (blob: Blob) => {
      const gen = ++generationRef.current;
      setPhase("processing");
      setStage("read");
      setProgress(0);
      setError(null);
      setCompare("cleaned");
      try {
        const { processClip } = await import("@/lib/media/process");
        const out = await processClip({
          blob,
          intensity: intensity / 100,
          preset,
          onProgress: (p) => {
            if (gen !== generationRef.current) return;
            setStage(p.stage);
            setProgress(p.progress);
          },
        });
        if (gen !== generationRef.current) return;
        const next = rememberUrl(URL.createObjectURL(out.blob));
        setCleanedUrl(next);
        setResult({
          filename: out.filename,
          originalBytes: out.originalBytes,
          cleanedBytes: out.cleanedBytes,
          duration: out.duration,
          blob: out.blob,
        });
        setOriginalPeaks(out.originalAudio ? computePeaks(out.originalAudio) : []);
        setCleanedPeaks(out.cleanedAudio ? computePeaks(out.cleanedAudio) : []);
        setPhase("ready");
      } catch (err) {
        if (gen !== generationRef.current) return;
        const message = err instanceof Error ? err.message : "Couldn’t clean this clip.";
        setError(message);
        setPhase(originalUrl ? "ready" : "idle");
        toast.error(message);
      }
    },
    [intensity, preset, originalUrl],
  );

  const ingestBlob = useCallback(
    async (blob: Blob) => {
      if (blob.size < 32) {
        toast.error("That file looks empty.");
        return;
      }
      if (blob.size > 280 * 1024 * 1024) {
        toast.error("Keep clips under 280 MB on this device.");
        return;
      }
      stopStream(streamRef.current);
      streamRef.current = null;
      originalBlobRef.current = blob;
      const url = rememberUrl(URL.createObjectURL(blob));
      setOriginalUrl(url);
      setCleanedUrl(null);
      setResult(null);
      await runProcess(blob);
    },
    [runProcess],
  );

  const beginLive = useCallback(
    async (nextFacing: Facing = facing) => {
      setError(null);
      try {
        stopStream(streamRef.current);
        const stream = await openCamera(nextFacing);
        streamRef.current = stream;
        setPhase("live");
        requestAnimationFrame(() => {
          const el = liveVideoRef.current;
          if (!el) return;
          el.srcObject = stream;
          el.muted = true;
          el.playsInline = true;
          void el.play().catch(() => undefined);
        });
      } catch (err) {
        setPhase("idle");
        const message = cameraErrorMessage(err);
        setError(message);
        toast.error(message);
      }
    },
    [facing],
  );

  const flipCamera = async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (phase === "live") await beginLive(next);
  };

  const startRec = () => {
    const stream = streamRef.current;
    if (!stream) return;
    recorderRef.current = startRecording(stream);
    setElapsed(0);
    setPhase("recording");
    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      const sec = (Date.now() - started) / 1000;
      setElapsed(sec);
      if (sec >= 5 * 60) void stopRec();
    }, 200);
  };

  const stopRec = async () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    const handle = recorderRef.current;
    recorderRef.current = null;
    if (!handle) {
      setPhase("live");
      return;
    }
    try {
      const blob = await handle.stop();
      stopStream(streamRef.current);
      streamRef.current = null;
      await ingestBlob(blob);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Recording failed.";
      toast.error(message);
      setPhase("idle");
    }
  };

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name)) {
      toast.error("Drop a video file.");
      return;
    }
    void ingestBlob(file);
  };

  const onTrySample = async () => {
    setPhase("processing");
    setStage("read");
    setProgress(0.04);
    try {
      const { createNoisySample } = await import("@/lib/media/demo");
      const blob = await createNoisySample();
      await ingestBlob(blob);
    } catch (err) {
      setPhase("idle");
      toast.error(err instanceof Error ? err.message : "Couldn’t build the sample.");
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = rememberUrl(URL.createObjectURL(result.blob));
    a.download = result.filename;
    a.click();
    toast.success("Saved the cleaned clip.");
  };

  const activeVideo = compare === "original" ? origVideoRef.current : cleanVideoRef.current;

  const togglePlay = () => {
    const el = activeVideo;
    if (!el) return;
    if (el.paused) {
      void el.play();
      const other = compare === "original" ? cleanVideoRef.current : origVideoRef.current;
      if (other) {
        other.currentTime = el.currentTime;
        void other.play();
      }
    } else {
      el.pause();
      origVideoRef.current?.pause();
      cleanVideoRef.current?.pause();
    }
  };

  const onTime = (el: HTMLVideoElement) => {
    const d = el.duration || 1;
    setPlayProgress(el.currentTime / d);
    const other = el === origVideoRef.current ? cleanVideoRef.current : origVideoRef.current;
    if (other && Math.abs(other.currentTime - el.currentTime) > 0.18) {
      other.currentTime = el.currentTime;
    }
  };

  const savings = result && result.originalBytes > 0 ? 1 - result.cleanedBytes / result.originalBytes : 0;
  const live = phase === "live" || phase === "recording";
  const hasPicture = Boolean(originalUrl);

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Mark className="size-8" />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">ClearTake</p>
              <p className="text-xs text-muted-foreground">On-device voice clean</p>
            </div>
          </div>
          <div className="flex rounded-full bg-surface p-1 shadow-border">
            {PRESET_ORDER.map((id) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPreset(id)}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-medium transition-colors duration-[var(--motion-quick)]",
                      preset === id
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {PRESETS[id].label}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{PRESETS[id].hint}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pb-10 sm:px-6">
          <section className="rise-in grid gap-2 sm:max-w-xl">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Wireless-mic voice. A lighter file.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              Record or drop a clip. We strip room noise, level your voice like a close Bluetooth mic, then pack a
              smaller video that still looks sharp. Nothing leaves this device.
            </p>
          </section>

          <section
            className={cn(
              "rise-in rise-in-delay-1 relative overflow-hidden rounded-3xl bg-surface p-2 shadow-border",
              dragOver && "ring-2 ring-foreground/40",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onPickFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-background">
              {live ? (
                <video
                  ref={liveVideoRef}
                  className={cn(
                    "h-full w-full object-cover",
                    facing === "user" && "scale-x-[-1]",
                  )}
                  playsInline
                  muted
                  autoPlay
                />
              ) : null}

              {originalUrl ? (
                <video
                  ref={origVideoRef}
                  src={originalUrl}
                  className={cn(
                    "absolute inset-0 h-full w-full object-contain transition-opacity duration-[var(--motion-fast)]",
                    live || compare !== "original" ? "pointer-events-none opacity-0" : "opacity-100",
                    phase === "processing" && "opacity-40",
                  )}
                  playsInline
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(e) => onTime(e.currentTarget)}
                  onEnded={() => setPlaying(false)}
                />
              ) : null}

              {cleanedUrl ? (
                <video
                  ref={cleanVideoRef}
                  src={cleanedUrl}
                  className={cn(
                    "absolute inset-0 h-full w-full object-contain transition-opacity duration-[var(--motion-fast)]",
                    live || compare !== "cleaned" ? "pointer-events-none opacity-0" : "opacity-100",
                  )}
                  playsInline
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(e) => onTime(e.currentTarget)}
                  onEnded={() => setPlaying(false)}
                />
              ) : null}

              {phase === "idle" ? <IdleField /> : null}

              <span className="finder-corner top-3 left-3 rounded-tl-sm border-t border-l" />
              <span className="finder-corner top-3 right-3 rounded-tr-sm border-t border-r" />
              <span className="finder-corner bottom-3 left-3 rounded-bl-sm border-b border-l" />
              <span className="finder-corner bottom-3 right-3 rounded-br-sm border-b border-r" />

              {phase === "recording" ? (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium">
                  <span className="rec-dot size-2 rounded-full bg-rec" />
                  <span className="tabular-nums">{formatDuration(elapsed)}</span>
                </div>
              ) : null}

              {phase === "ready" && cleanedUrl ? (
                <div className="absolute top-3 left-3 flex rounded-full bg-background/75 p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setCompare("original")}
                    className={cn(
                      "rounded-full px-3 py-1 transition-colors",
                      compare === "original" ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompare("cleaned")}
                    className={cn(
                      "rounded-full px-3 py-1 transition-colors",
                      compare === "cleaned" ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                  >
                    Cleaned
                  </button>
                </div>
              ) : null}

              {phase === "processing" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/55 px-6 text-center">
                  <LoaderCircle className="size-6 animate-spin text-foreground" />
                  <p className="text-sm font-medium">{STAGE_LABEL[stage]}</p>
                  <div className="w-full max-w-xs">
                    <Progress value={progress * 100} />
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">{formatPct(progress)}</p>
                  </div>
                </div>
              ) : null}

              {phase === "ready" && hasPicture ? (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-foreground text-background shadow-border"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
                </button>
              ) : null}
            </div>
          </section>

          {phase === "idle" || phase === "live" || phase === "recording" ? (
            <div className="rise-in rise-in-delay-2 flex flex-wrap items-center justify-center gap-3">
              {phase === "idle" ? (
                <>
                  <Button size="lg" onClick={() => void beginLive()}>
                    <Mic />
                    Record
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload />
                    Upload
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => void onTrySample()}>
                    <Volume2 />
                    Noisy sample
                  </Button>
                </>
              ) : null}
              {phase === "live" ? (
                <>
                  <Button size="lg" variant="rec" onClick={startRec}>
                    <span className="size-2.5 rounded-full bg-foreground" />
                    Start recording
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => void flipCamera()} aria-label="Flip camera">
                    <SwitchCamera />
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => { stopStream(streamRef.current); streamRef.current = null; setPhase("idle"); }}>
                    Cancel
                  </Button>
                </>
              ) : null}
              {phase === "recording" ? (
                <Button size="lg" variant="outline" onClick={() => void stopRec()}>
                  <Square className="size-3.5 fill-current" />
                  Stop
                </Button>
              ) : null}
            </div>
          ) : null}

          {phase === "ready" && result ? (
            <section className="rise-in grid gap-4 rounded-3xl bg-surface p-4 shadow-border sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Original room
                  </p>
                  <Waveform peaks={originalPeaks} progress={compare === "original" ? playProgress : 0} dimmed={compare !== "original"} />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Cleaned voice
                  </p>
                  <Waveform peaks={cleanedPeaks} progress={compare === "cleaned" ? playProgress : 0} dimmed={compare !== "cleaned"} />
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <span className="tabular-nums text-foreground">{formatBytes(result.originalBytes)}</span>
                    <span className="mx-2 text-subtle">→</span>
                    <span className="tabular-nums text-foreground">{formatBytes(result.cleanedBytes)}</span>
                  </p>
                  <p className="mt-1 text-sm">
                    {savings > 0.04 ? (
                      <span className="font-medium text-save">{formatPct(savings)} smaller</span>
                    ) : (
                      <span className="text-muted-foreground">Packed at the selected size</span>
                    )}
                    <span className="text-subtle"> · </span>
                    <span className="tabular-nums text-muted-foreground">{formatDuration(result.duration)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => originalBlobRef.current && void runProcess(originalBlobRef.current)}>
                    Apply again
                  </Button>
                  <Button onClick={download}>
                    <Download />
                    Download
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rise-in rise-in-delay-3 grid gap-4 rounded-3xl bg-surface p-4 shadow-border sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <label htmlFor="clean-amount" className="text-sm font-medium">
                  Voice clean
                </label>
                <span className="text-xs tabular-nums text-muted-foreground">{intensity}</span>
              </div>
              <Slider
                id="clean-amount"
                min={0}
                max={100}
                step={1}
                value={[intensity]}
                onValueChange={(v) => setIntensity(v[0] ?? 72)}
                disabled={phase === "processing" || phase === "recording"}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Higher strips more room tone and levels like a close mic. Lower keeps more of the space.
              </p>
            </div>
            {phase === "ready" ? (
              <Button
                variant="ghost"
                onClick={() => {
                  resetMedia();
                  setPhase("idle");
                }}
              >
                New clip
              </Button>
            ) : null}
          </section>

          {error && phase === "idle" ? (
            <p className="text-center text-sm text-rec">{error}</p>
          ) : null}

          <ol className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <li className="rounded-2xl bg-surface/80 px-4 py-4 shadow-border">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Capture</p>
              <p className="mt-1.5 text-foreground">Record in the browser or drop a take from your camera roll.</p>
            </li>
            <li className="rounded-2xl bg-surface/80 px-4 py-4 shadow-border">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Clean</p>
              <p className="mt-1.5 text-foreground">Noise falls away. Voice is gated, equalized, and limited like a wireless lav.</p>
            </li>
            <li className="rounded-2xl bg-surface/80 px-4 py-4 shadow-border">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Shrink</p>
              <p className="mt-1.5 text-foreground">The picture is re-encoded smaller so the download actually fits.</p>
            </li>
          </ol>
        </main>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            onPickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function IdleField() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="relative size-28">
        <span className="absolute inset-0 rounded-full border border-border" />
        <span className="absolute inset-3 rounded-full border border-border/80" />
        <span className="absolute inset-6 rounded-full border border-foreground/20" />
        <span className="absolute inset-[42%] rounded-full bg-foreground/80" />
      </div>
      <div>
        <p className="text-sm font-medium">Drop a video, or start a take</p>
        <p className="mt-1 text-xs text-muted-foreground">Laptop mics welcome. We do the close-mic work after.</p>
      </div>
    </div>
  );
}
