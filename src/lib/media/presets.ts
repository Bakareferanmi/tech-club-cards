export type SizePreset = "compact" | "balanced" | "crisp";

export type PresetConfig = {
  id: SizePreset;
  label: string;
  hint: string;
  /** Cap on output picture height. Source is never upscaled. */
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  channels: 1 | 2;
};

export const PRESETS: Record<SizePreset, PresetConfig> = {
  compact: {
    id: "compact",
    label: "Compact",
    hint: "Smallest file, still sharp on a phone",
    height: 720,
    videoBitrate: 900_000,
    audioBitrate: 64_000,
    channels: 1,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    hint: "Wireless-mic voice, light picture",
    height: 720,
    videoBitrate: 1_600_000,
    audioBitrate: 96_000,
    channels: 2,
  },
  crisp: {
    id: "crisp",
    label: "Crisp",
    hint: "Keeps more picture detail",
    height: 1080,
    videoBitrate: 2_800_000,
    audioBitrate: 128_000,
    channels: 2,
  },
};

export const PRESET_ORDER: SizePreset[] = ["compact", "balanced", "crisp"];
