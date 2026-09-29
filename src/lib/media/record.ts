import { pickRecorderMime } from "@/lib/media/mime";

export type Facing = "user" | "environment";

export async function openCamera(facing: Facing): Promise<MediaStream> {
  const baseVideo: MediaTrackConstraints = {
    facingMode: { ideal: facing },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  };
  const tries: MediaStreamConstraints[] = [
    {
      video: baseVideo,
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 1 },
      },
    },
    {
      video: baseVideo,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    },
    { video: true, audio: true },
  ];

  let last: unknown;
  for (const constraints of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("Camera or microphone isn’t available.");
}

export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access is blocked. Upload a clip or try the noisy sample.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera found on this device. Upload a clip or try the sample.";
  }
  if (name === "NotReadableError") {
    return "The camera is busy in another tab. Close it, or upload a clip instead.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn’t open the camera. Upload a clip or try the sample.";
}

export type RecorderHandle = {
  stop: () => Promise<Blob>;
};

export function startRecording(stream: MediaStream): RecorderHandle {
  const mime = pickRecorderMime();
  const rec = new MediaRecorder(stream, {
    mimeType: mime || undefined,
    videoBitsPerSecond: 5_000_000,
    audioBitsPerSecond: 160_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start(200);

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        rec.onerror = () => reject(new Error("Recording failed."));
        rec.onstop = () => {
          const type = rec.mimeType || mime || "video/webm";
          resolve(new Blob(chunks, { type }));
        };
        if (rec.state === "inactive") {
          resolve(new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }));
          return;
        }
        rec.stop();
      }),
  };
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}
