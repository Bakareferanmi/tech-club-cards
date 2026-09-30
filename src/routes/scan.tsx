import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ImageUp } from "lucide-react";
import jsQR from "jsqr";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { decodePayload } from "@/lib/payload";

export const Route = createFileRoute("/scan")({
  component: ScanPage,
});

type NativeDetector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

function makeNativeDetector(): NativeDetector | null {
  try {
    const Ctor = (
      window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => NativeDetector;
      }
    ).BarcodeDetector;
    return Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/** Returns the card token if the QR text is a Tech Club verify link. */
function tokenFromQr(text: string): string | null {
  try {
    const url = new URL(text);
    if (url.pathname !== "/verify") return null;
    const p = url.searchParams.get("p");
    return p && decodePayload(p) ? p : null;
  } catch {
    return null;
  }
}

function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  function openCard(token: string) {
    void navigate({ to: "/verify", search: { p: token } });
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let busy = false;
    let lastBadAt = 0;
    const detector = makeNativeDetector();

    function readWithJsQr(video: HTMLVideoElement): string | null {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height)?.data ?? null;
    }

    function handleText(text: string): boolean {
      const token = tokenFromQr(text);
      if (token) {
        stopped = true;
        openCard(token);
        return true;
      }
      if (Date.now() - lastBadAt > 2000) {
        lastBadAt = Date.now();
        setError("That QR code is not a Tech Club access card.");
      }
      return false;
    }

    async function tick() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !busy) {
        busy = true;
        try {
          let text: string | null = null;
          if (detector) {
            try {
              const codes = await detector.detect(video);
              text = codes[0]?.rawValue ?? null;
            } catch {
              text = null;
            }
          } else {
            text = readWithJsQr(video);
          }
          if (text && handleText(text)) return;
        } finally {
          busy = false;
        }
      }
      if (!stopped) frame = requestAnimationFrame(() => void tick());
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
        frame = requestAnimationFrame(() => void tick());
      } catch {
        setError("Camera is blocked. Allow camera access in your browser, or choose a photo of the card instead.");
      }
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hit = jsQR(data.data, data.width, data.height);
      const token = hit?.data ? tokenFromQr(hit.data) : null;
      if (token) openCard(token);
      else setError("No Tech Club QR code found in that photo. Try a closer, sharper picture.");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("That file could not be opened as an image.");
    };
    img.src = url;
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
        <h1 className="font-display text-2xl font-bold text-navy">Scan a card</h1>
        <p className="text-center text-sm text-muted">
          Hold the QR code on the printed card inside the frame.
        </p>

        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-navy">
          <video ref={videoRef} className="size-full object-cover" playsInline muted />
          {!cameraReady && !error && (
            <div className="absolute inset-0 grid place-items-center text-sm text-primary-fg">
              Starting camera…
            </div>
          )}
          <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-primary" />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {error && (
          <p role="alert" className="text-center text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary">
            <label className="cursor-pointer">
              <ImageUp />
              Choose a photo
              <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
            </label>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to studio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
