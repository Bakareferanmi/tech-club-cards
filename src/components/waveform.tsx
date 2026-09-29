import { cn } from "@/lib/utils";

type WaveformProps = {
  peaks: number[];
  progress?: number;
  className?: string;
  dimmed?: boolean;
};

export function Waveform({ peaks, progress = 0, className, dimmed }: WaveformProps) {
  if (peaks.length === 0) {
    return <div className={cn("h-10", className)} />;
  }
  return (
    <div
      className={cn("flex h-10 items-end gap-px", dimmed && "opacity-40", className)}
      aria-hidden="true"
    >
      {peaks.map((p, i) => {
        const played = i / peaks.length <= progress;
        return (
          <span
            key={i}
            className={cn(
              "min-w-px flex-1 rounded-full transition-colors duration-150",
              played ? "bg-foreground" : "bg-foreground/25",
            )}
            style={{ height: `${Math.max(8, p * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
