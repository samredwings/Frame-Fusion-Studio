import { useState, useRef, useCallback, useEffect } from "react";
import { VideoSource, Project, useAddSource } from "@workspace/api-client-react";
import { Layers, Play, Pause, ChevronLeft, ChevronRight, UploadCloud, Loader2, Shuffle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Timeline } from "./timeline";
import { useVideoMeta, formatDuration } from "@/hooks/use-video-meta";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface MultiCompareProps {
  project: Project;
  sources: VideoSource[];
}

type Track = {
  id: string;
  label: string;
  file: File | null;
  objectUrl: string | null;
  duration: number;
  fps: number;
  offset: number;
  saved: boolean;
};

function makeTrack(label: string): Track {
  return { id: crypto.randomUUID(), label, file: null, objectUrl: null, duration: 0, fps: 30, offset: 0, saved: false };
}

async function uploadToStorage(file: File): Promise<string> {
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!res.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await res.json() as { uploadURL: string; objectPath: string };
  await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  return objectPath;
}

function captureFrame(video: HTMLVideoElement): ImageData | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 320);
    canvas.height = Math.min(video.videoHeight, 180);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch { return null; }
}

function computeSimilarity(a: ImageData, b: ImageData): number {
  const len = Math.min(a.data.length, b.data.length);
  let diff = 0;
  for (let i = 0; i < len; i += 4) {
    diff += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return 1 - diff / (len * 255 * 0.75);
}

export function MultiCompare({ project, sources }: MultiCompareProps) {
  const queryClient = useQueryClient();
  const [tracks, setTracks] = useState<Track[]>([makeTrack("A"), makeTrack("B")]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const rafRef = useRef<number | null>(null);

  const { analyzeFile } = useVideoMeta();
  const createSource = useAddSource();

  const maxDuration = Math.max(...tracks.map((t) => t.duration + t.offset), 1);

  const handleAddTrack = useCallback(() => {
    if (tracks.length >= 4) return;
    const labels = ["A", "B", "C", "D"];
    setTracks((prev) => [...prev, makeTrack(labels[prev.length])]);
  }, [tracks.length]);

  const handleFileLoad = useCallback(async (trackId: string, file: File) => {
    setUploadingId(trackId);
    try {
      const [meta, objectPath] = await Promise.all([
        analyzeFile(file),
        uploadToStorage(file),
      ]);
      const objectUrl = URL.createObjectURL(file);
      setTracks((prev) => prev.map((t) =>
        t.id === trackId
          ? { ...t, file, objectUrl, duration: meta.duration, fps: meta.fps }
          : t
      ));
      await createSource.mutateAsync({
        id: project.id,
        data: {
          filename: file.name,
          objectPath,
          role: "comparison",
          fps: meta.fps,
          totalFrames: meta.frameCount,
          durationMs: Math.round(meta.duration * 1000),
          width: meta.width,
          height: meta.height,
          fileSize: file.size,
        },
      });
      setTracks((prev) => prev.map((t) => t.id === trackId ? { ...t, saved: true } : t));
      await queryClient.invalidateQueries({ queryKey: ["listSources", project.id] });
    } finally {
      setUploadingId(null);
    }
  }, [analyzeFile, createSource, project.id, queryClient]);

  const syncToFrame = useCallback((time: number) => {
    tracks.forEach((t) => {
      const vid = videoRefs.current[t.id];
      if (vid && t.objectUrl) {
        const target = time - t.offset;
        if (Math.abs(vid.currentTime - target) > 0.04) vid.currentTime = Math.max(0, target);
      }
    });
  }, [tracks]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      tracks.forEach((t) => videoRefs.current[t.id]?.pause());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
    } else {
      tracks.forEach((t) => {
        const vid = videoRefs.current[t.id];
        if (vid && t.objectUrl) vid.play().catch(() => {});
      });
      const tick = () => {
        const firstVid = Object.values(videoRefs.current).find((v) => v && !v.paused);
        if (firstVid) setCurrentTime(firstVid.currentTime + (tracks.find((t) => videoRefs.current[t.id] === firstVid)?.offset ?? 0));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setIsPlaying(true);
    }
  }, [isPlaying, tracks]);

  const handleSeek = useCallback((frame: number) => {
    const time = frame / (tracks[0]?.fps ?? 30);
    setCurrentTime(time);
    syncToFrame(time);
  }, [tracks, syncToFrame]);

  const handleStep = useCallback((delta: number) => {
    const fps = tracks[0]?.fps ?? 30;
    const newTime = Math.max(0, Math.min(maxDuration, currentTime + delta / fps));
    setCurrentTime(newTime);
    syncToFrame(newTime);
  }, [currentTime, maxDuration, tracks, syncToFrame]);

  const handleAutoSync = useCallback(async () => {
    const loaded = tracks.filter((t) => t.objectUrl);
    if (loaded.length < 2) return;
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const referenceVid = videoRefs.current[loaded[0].id];
      if (!referenceVid) return;
      referenceVid.currentTime = 0.5;
      await new Promise((r) => setTimeout(r, 200));
      const refFrame = captureFrame(referenceVid);
      if (!refFrame) return;

      const offsets: number[] = [0];
      for (let i = 1; i < loaded.length; i++) {
        const vid = videoRefs.current[loaded[i].id];
        if (!vid) { offsets.push(0); continue; }

        let bestOffset = 0;
        let bestScore = -1;
        const step = 1 / loaded[i].fps;
        const maxScan = Math.min(loaded[i].duration, 10);

        for (let t = 0; t <= maxScan; t += step) {
          vid.currentTime = t;
          await new Promise((r) => setTimeout(r, 80));
          const frame = captureFrame(vid);
          if (!frame) continue;
          const score = computeSimilarity(refFrame, frame);
          if (score > bestScore) { bestScore = score; bestOffset = -t; }
        }
        offsets.push(bestOffset);
      }

      setTracks((prev) => prev.map((t, i) => {
        const li = loaded.findIndex((l) => l.id === t.id);
        return li >= 0 ? { ...t, offset: offsets[li] } : t;
      }));
      setSyncResult(`Auto-sync complete (${loaded.length} tracks)`);
    } finally {
      setIsSyncing(false);
    }
  }, [tracks]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const currentFrameNum = Math.round(currentTime * (tracks[0]?.fps ?? 30));
  const totalFrameNum = Math.round(maxDuration * (tracks[0]?.fps ?? 30));
  const gridCols = tracks.length <= 1 ? "grid-cols-1" : tracks.length === 2 ? "grid-cols-2" : "grid-cols-2";

  return (
    <div className="h-full w-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-2">
          {tracks.length < 4 && (
            <Button variant="outline" size="sm" className="h-8 text-xs font-mono" onClick={handleAddTrack}>
              <Layers className="w-3.5 h-3.5 mr-2" />Add Track
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono"
            onClick={handleAutoSync} disabled={isSyncing || tracks.filter((t) => t.objectUrl).length < 2}>
            {isSyncing
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Syncing…</>
              : <><Shuffle className="w-3.5 h-3.5 mr-1.5" />Auto-Sync</>}
          </Button>
          {syncResult && (
            <Badge variant="outline" className="text-[10px] font-mono text-green-400 border-green-400/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />{syncResult}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStep(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-8 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handlePlayPause}>
            {isPlaying ? <><Pause className="w-3.5 h-3.5 mr-1.5" />Pause</> : <><Play className="w-3.5 h-3.5 mr-1.5" />Play All</>}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStep(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground">
            {formatDuration(currentTime)}
          </span>
        </div>
      </div>

      {isSyncing && <Progress className="h-0.5 rounded-none" />}

      {/* Video grid */}
      <div className="flex-1 overflow-hidden p-3 flex flex-col gap-3">
        <div className={cn("flex-1 grid gap-3", gridCols)}>
          {tracks.map((track) => (
            <div key={track.id} className="relative bg-black border border-border rounded-lg overflow-hidden flex items-center justify-center group">
              <span className="absolute top-2 left-2 z-10 bg-background/80 px-2 py-0.5 rounded font-mono text-[10px] text-muted-foreground uppercase tracking-widest border border-border/50">
                Track {track.label}
                {track.saved && <CheckCircle2 className="inline w-2.5 h-2.5 ml-1 text-green-400" />}
              </span>

              {track.objectUrl ? (
                <video
                  ref={(el) => { videoRefs.current[track.id] = el; }}
                  src={track.objectUrl}
                  className="w-full h-full object-contain"
                  playsInline
                  muted
                  preload="metadata"
                />
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                  <input type="file" accept="video/*" className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handleFileLoad(track.id, e.target.files[0])} />
                  {uploadingId === track.id
                    ? <Loader2 className="w-8 h-8 animate-spin" />
                    : <>
                        <UploadCloud className="w-8 h-8" />
                        <span className="text-xs font-mono">Drop or click to load</span>
                      </>}
                </label>
              )}

              {track.offset !== 0 && (
                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                  offset {track.offset > 0 ? "+" : ""}{track.offset.toFixed(2)}s
                </span>
              )}

              {track.file && (
                <div className="absolute bottom-2 left-2 flex gap-1 items-center">
                  <input
                    type="range"
                    min={-track.duration}
                    max={track.duration}
                    step={0.033}
                    value={track.offset}
                    className="w-20 h-1 accent-orange-400"
                    onChange={(e) => setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, offset: Number(e.target.value) } : t))}
                    title={`Offset: ${track.offset.toFixed(2)}s`}
                  />
                  <span className="text-[9px] font-mono text-white/60">sync</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="shrink-0 border border-border rounded-lg bg-card/50 p-3">
          <Timeline
            totalFrames={totalFrameNum}
            currentFrame={currentFrameNum}
            onSeek={handleSeek}
            fps={tracks[0]?.fps ?? 30}
          />
        </div>
      </div>
    </div>
  );
}
