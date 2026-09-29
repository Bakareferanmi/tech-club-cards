import {
  canEncodeAudio,
  canEncodeVideo,
  Mp4OutputFormat,
  Quality,
  WebMOutputFormat,
  type AudioCodec,
  type OutputFormat,
  type VideoCodec,
} from "mediabunny";

export type EncodeProfile = {
  format: OutputFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  extension: "mp4" | "webm";
  mime: string;
};

export async function pickEncodeProfile(
  width: number,
  height: number,
  videoBitrate: number,
  audioBitrate: number,
): Promise<EncodeProfile> {
  const vq = new Quality({ bitrate: videoBitrate, bitrateMode: "variable" });
  const aq = new Quality({ bitrate: audioBitrate, bitrateMode: "variable" });

  const avc = await canEncodeVideo("avc", { width, height, quality: vq });
  const aac = await canEncodeAudio("aac", { quality: aq });
  if (avc && aac) {
    return {
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      videoCodec: "avc",
      audioCodec: "aac",
      extension: "mp4",
      mime: "video/mp4",
    };
  }

  const vp9 = await canEncodeVideo("vp9", { width, height, quality: vq });
  const opus = await canEncodeAudio("opus", { quality: aq });
  if (vp9 && opus) {
    return {
      format: new WebMOutputFormat(),
      videoCodec: "vp9",
      audioCodec: "opus",
      extension: "webm",
      mime: "video/webm",
    };
  }

  const vp8 = await canEncodeVideo("vp8", { width, height, quality: vq });
  if (vp8 && opus) {
    return {
      format: new WebMOutputFormat(),
      videoCodec: "vp8",
      audioCodec: "opus",
      extension: "webm",
      mime: "video/webm",
    };
  }

  if (avc) {
    const audio: AudioCodec = aac ? "aac" : opus ? "opus" : "aac";
    return {
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      videoCodec: "avc",
      audioCodec: audio,
      extension: "mp4",
      mime: "video/mp4",
    };
  }

  throw new Error("This browser can’t encode video. Try Chrome or Edge.");
}
