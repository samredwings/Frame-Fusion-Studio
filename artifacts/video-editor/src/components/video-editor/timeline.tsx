import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export type TimelineMarker = {
  frameIndex: number;
  type: "edit" | "blur" | "sync" | "keyframe";
  label?: string;
};

interface TimelineProps {
  totalFrames: number;
  currentFrame: number;
  onSeek: (frame: number) => void;
  markers?: TimelineMarker[];
  fps?: number;
  className?: string;
}

const MARKER_COLORS: Record<TimelineMarker["type"], string> = {
  edit: "bg-orange-400",
  blur: "bg-purple-400",
  sync: "bg-blue-400",
  keyframe: "bg-yellow-400",
};

const MARKER_TOOLTIP: Record<TimelineMarker["type"], string> = {
  edit: "Frame Edit",
  blur: "Blur Region",
  sync: "Sync Point",
  keyframe: "Key Frame",
};

export function Timeline({ totalFrames, currentFrame, onSeek, markers = [], fps = 30, className }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const seek = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * (totalFrames - 1)));
  }, [totalFrames, onSeek]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    seek(e.clientX);
    const onMove = (ev: MouseEvent) => seek(ev.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [seek]);

  const playheadPct = totalFrames > 0 ? (currentFrame / (totalFrames - 1)) * 100 : 0;
  const currentSec = fps > 0 ? currentFrame / fps : 0;
  const totalSec = fps > 0 ? (totalFrames - 1) / fps : 0;

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex flex-col gap-1 select-none", className)}>
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
        <span>{fmt(currentSec)} — Frame {currentFrame}</span>
        <div className="flex items-center gap-3">
          {(["edit", "blur", "sync", "keyframe"] as TimelineMarker["type"][]).map((t) =>
            markers.some((m) => m.type === t) ? (
              <span key={t} className="flex items-center gap-1">
                <span className={cn("w-2 h-2 rounded-full inline-block", MARKER_COLORS[t])} />
                {MARKER_TOOLTIP[t]}
              </span>
            ) : null
          )}
          <span>{fmt(totalSec)} / {totalFrames}f</span>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative h-6 bg-muted/30 border border-border/50 rounded cursor-pointer group"
        onMouseDown={onMouseDown}
      >
        <div
          className="absolute inset-y-0 left-0 bg-primary/20 rounded-l transition-none"
          style={{ width: `${playheadPct}%` }}
        />

        {markers.map((m, i) => {
          const pct = totalFrames > 0 ? (m.frameIndex / (totalFrames - 1)) * 100 : 0;
          return (
            <div
              key={i}
              className={cn("absolute top-0.5 w-1.5 h-5 rounded-sm opacity-80 hover:opacity-100 hover:scale-125 transition-transform", MARKER_COLORS[m.type])}
              style={{ left: `calc(${pct}% - 3px)` }}
              title={m.label ?? `${MARKER_TOOLTIP[m.type]} at frame ${m.frameIndex}`}
            />
          );
        })}

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_4px_rgba(255,140,0,0.8)] transition-none"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-primary rounded-full" />
        </div>

        <div className="absolute inset-0 flex items-center pointer-events-none">
          {Array.from({ length: Math.min(20, totalFrames) }).map((_, i) => {
            const pct = (i / Math.min(19, totalFrames - 1)) * 100;
            return (
              <div
                key={i}
                className="absolute h-2 w-px bg-border/40"
                style={{ left: `${pct}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
