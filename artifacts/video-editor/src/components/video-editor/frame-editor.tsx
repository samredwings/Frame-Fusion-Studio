import { useState, useRef, useCallback } from "react";
import { VideoSource, Project, useAddSource, useCreateFrameEdit, useListFrameEdits } from "@workspace/api-client-react";
import { Film, UploadCloud, Download, ChevronLeft, ChevronRight, Replace, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useFFmpeg } from "@/hooks/use-ffmpeg";
import { useVideoMeta, formatFileSize, formatDuration } from "@/hooks/use-video-meta";
import { Timeline, type TimelineMarker } from "./timeline";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface FrameEditorProps {
  project: Project;
  sources: VideoSource[];
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

export function FrameEditor({ project, sources }: FrameEditorProps) {
  const queryClient = useQueryClient();
  const [activeSource, setActiveSource] = useState<VideoSource | null>(sources[0] ?? null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [frames, setFrames] = useState<{ index: number; timestamp: number; dataUrl: string }[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [extractFps, setExtractFps] = useState(2);
  const [isDragOver, setIsDragOver] = useState(false);
  const [replaceDragOver, setReplaceDragOver] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);

  const { isLoading, isProcessing, progress, error: ffmpegError, load, getVideoInfo: _gvi, extractFrames, encodeVideo } = useFFmpeg();
  const { analyzeFile } = useVideoMeta();
  const isLoaded = !isLoading;

  const createSource = useAddSource();
  const createFrameEdit = useCreateFrameEdit();
  const { data: frameEdits } = useListFrameEdits(project.id);

  const handleFileDrop = useCallback(async (file: File) => {
    setLocalFile(file);
    setUploadState("uploading");
    setUploadProgress(15);
    try {
      const [meta, objectPath] = await Promise.all([
        analyzeFile(file),
        uploadToStorage(file),
      ]);
      setUploadProgress(80);
      const src = await createSource.mutateAsync({
        id: project.id,
        data: {
          filename: file.name,
          objectPath,
          role: "primary",
          fps: meta.fps,
          totalFrames: meta.frameCount,
          durationMs: Math.round(meta.duration * 1000),
          width: meta.width,
          height: meta.height,
          fileSize: file.size,
        },
      });
      setActiveSource(src);
      await queryClient.invalidateQueries({ queryKey: ["listSources", project.id] });
      setUploadProgress(100);
      setUploadState("done");
    } catch {
      setUploadState("error");
    }
  }, [project.id, createSource, analyzeFile, queryClient]);

  const handleExtract = useCallback(async () => {
    if (!localFile) return;
    const extracted = await extractFrames(localFile, { fps: extractFps, maxFrames: 120 });
    setFrames(extracted);
    setCurrentFrame(0);
  }, [localFile, extractFrames, extractFps]);

  const handleReplaceFrame = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      setFrames((prev) => prev.map((f, i) => i === currentFrame ? { ...f, dataUrl } : f));
      if (activeSource) {
        await createFrameEdit.mutateAsync({
          id: project.id,
          data: {
            frameIndex: frames[currentFrame]?.index ?? currentFrame,
            editType: "replace",
            sourceId: activeSource.id,
            replacementDataUrl: dataUrl,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["listFrameEdits", project.id] });
      }
    };
    reader.readAsDataURL(file);
  }, [frames, currentFrame, activeSource, project.id, createFrameEdit, queryClient]);

  const handleDownloadFrame = useCallback(() => {
    const f = frames[currentFrame];
    if (!f) return;
    const a = document.createElement("a");
    a.href = f.dataUrl;
    a.download = `frame_${String(f.index).padStart(4, "0")}.png`;
    a.click();
  }, [frames, currentFrame]);

  const handleDownloadVideo = useCallback(async () => {
    if (!frames.length) return;
    const blob = await encodeVideo(frames.map((f) => f.dataUrl), extractFps, { format: "mp4" });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_edited.mp4`;
    a.click();
    URL.revokeObjectURL(url);
  }, [frames, extractFps, project.name, encodeVideo]);

  const editedFrameSet = new Set(frameEdits?.map((e) => e.frameIndex) ?? []);
  const markers: TimelineMarker[] = frames
    .filter((f) => editedFrameSet.has(f.index))
    .map((f) => ({ frameIndex: frames.indexOf(f), type: "edit" as const }));

  return (
    <div className="h-full w-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept="video/*" className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleFileDrop(e.target.files[0])} />
            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono pointer-events-none">
              <span>
                <UploadCloud className="w-3.5 h-3.5 mr-2" />
                {localFile ? localFile.name.slice(0, 22) + "…" : "Import Video"}
              </span>
            </Button>
          </label>
          {localFile && (
            <>
              <div className="w-px h-4 bg-border" />
              <select className="h-8 px-2 text-xs font-mono bg-background border border-border rounded"
                value={extractFps} onChange={(e) => setExtractFps(Number(e.target.value))}>
                {[1, 2, 5, 10, 24, 30].map((v) => <option key={v} value={v}>{v} fps</option>)}
              </select>
              <Button variant="outline" size="sm" className="h-8 text-xs font-mono"
                onClick={handleExtract} disabled={isProcessing || isLoading}>
                {isLoading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Loading…</> :
                  isProcessing ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{progress}%</> :
                  <><Film className="w-3.5 h-3.5 mr-1.5" />Extract Frames</>}
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {frames.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-mono" onClick={handleDownloadFrame}>
                <Download className="w-3.5 h-3.5 mr-1" />Frame
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs font-mono"
                onClick={handleDownloadVideo} disabled={isProcessing}>
                <Download className="w-3.5 h-3.5 mr-1" />Re-encode
              </Button>
            </>
          )}
          {uploadState === "uploading" && (
            <Badge variant="outline" className="text-[10px] font-mono animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />Uploading…
            </Badge>
          )}
          {uploadState === "done" && (
            <Badge variant="outline" className="text-[10px] font-mono text-green-400 border-green-400/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />Saved to Cloud
            </Badge>
          )}
          {uploadState === "error" && (
            <Badge variant="outline" className="text-[10px] font-mono text-red-400 border-red-400/30">
              <AlertCircle className="w-3 h-3 mr-1" />Upload Failed
            </Badge>
          )}
        </div>
      </div>

      {isProcessing && <Progress value={progress} className="h-0.5 rounded-none" />}
      {uploadState === "uploading" && <Progress value={uploadProgress} className="h-0.5 rounded-none" />}

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: sources */}
        <div className="w-52 border-r border-border bg-sidebar/50 p-3 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Sources</h3>
          {sources.length === 0 && !localFile && (
            <div className="text-center p-3 border border-dashed border-border/50 rounded text-muted-foreground text-xs">
              No sources yet
            </div>
          )}
          {sources.map((s) => (
            <button key={s.id} onClick={() => setActiveSource(s)}
              className={cn(
                "w-full text-left p-2 rounded text-xs font-mono border transition-colors",
                activeSource?.id === s.id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/30 hover:border-border text-muted-foreground hover:text-foreground"
              )}>
              <div className="truncate font-medium">{s.filename}</div>
              <div className="text-[10px] opacity-60 mt-0.5">
                {s.fps ? `${s.fps}fps` : "?fps"} · {s.totalFrames ?? "?"} frames
              </div>
              {s.fileSize && <div className="text-[10px] opacity-60">{formatFileSize(s.fileSize)}</div>}
            </button>
          ))}
          {localFile && uploadState !== "done" && (
            <div className="p-2 rounded border border-dashed border-orange-400/30 bg-orange-400/5 text-xs font-mono">
              <div className="text-orange-400 truncate">{localFile.name}</div>
              <div className="text-muted-foreground text-[10px] mt-0.5">{formatFileSize(localFile.size)} · uploading</div>
            </div>
          )}
          {ffmpegError && (
            <div className="p-2 rounded border border-red-400/30 bg-red-400/5 text-xs font-mono text-red-400 break-words">
              {ffmpegError}
            </div>
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!localFile && sources.length === 0 ? (
            /* Drop zone */
            <div
              className={cn(
                "flex-1 m-8 flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors",
                isDragOver ? "border-primary/60 bg-primary/5" : "border-border/30 hover:border-border/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f); }}
            >
              <UploadCloud className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
              <p className="text-sm font-mono font-medium text-muted-foreground">Drop a video file here</p>
              <p className="text-xs text-muted-foreground/50 mt-1">MP4, MOV, MKV, WebM, AVI</p>
              <label className="mt-4 cursor-pointer">
                <input type="file" accept="video/*" className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleFileDrop(e.target.files[0])} />
                <Button asChild variant="outline" size="sm" className="font-mono pointer-events-none">
                  <span>Browse Files</span>
                </Button>
              </label>
            </div>
          ) : frames.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Film className="w-10 h-10 opacity-30" />
              <p className="text-sm font-mono">
                {localFile ? 'Click "Extract Frames" to begin' : "Select a source and import a video"}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Frame viewer */}
              <div
                className={cn(
                  "flex-1 flex items-center justify-center bg-black/40 relative",
                  replaceDragOver && "ring-2 ring-inset ring-primary/60"
                )}
                onDragOver={(e) => { e.preventDefault(); setReplaceDragOver(true); }}
                onDragLeave={() => setReplaceDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setReplaceDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f?.type.startsWith("image/")) handleReplaceFrame(f);
                }}
              >
                {frames[currentFrame] && (
                  <img src={frames[currentFrame].dataUrl} alt={`Frame ${currentFrame}`}
                    className="max-h-full max-w-full object-contain" />
                )}
                {editedFrameSet.has(frames[currentFrame]?.index) && (
                  <Badge className="absolute top-3 right-3 bg-orange-500/90 text-white text-[10px] font-mono border-0">EDITED</Badge>
                )}
                {replaceDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <p className="text-white font-mono text-sm">Drop image to replace frame</p>
                  </div>
                )}
                {/* Top-left actions */}
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="sr-only"
                      onChange={(e) => e.target.files?.[0] && handleReplaceFrame(e.target.files[0])} />
                    <Button asChild variant="secondary" size="sm" className="h-7 text-xs font-mono pointer-events-none">
                      <span><Replace className="w-3 h-3 mr-1" />Replace</span>
                    </Button>
                  </label>
                  <Button variant="secondary" size="sm" className="h-7 text-xs font-mono" onClick={handleDownloadFrame}>
                    <Download className="w-3 h-3 mr-1" />Save
                  </Button>
                </div>
                {/* Nav controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <Button variant="secondary" size="icon" className="h-8 w-8"
                    onClick={() => setCurrentFrame((p) => Math.max(0, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-mono bg-black/70 text-white px-3 py-1.5 rounded-full">
                    {currentFrame + 1} / {frames.length} · {formatDuration(frames[currentFrame]?.timestamp ?? 0)}
                  </span>
                  <Button variant="secondary" size="icon" className="h-8 w-8"
                    onClick={() => setCurrentFrame((p) => Math.min(frames.length - 1, p + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Timeline + Filmstrip */}
              <div className="border-t border-border bg-background/80 p-3 space-y-2 shrink-0">
                <Timeline
                  totalFrames={frames.length}
                  currentFrame={currentFrame}
                  onSeek={setCurrentFrame}
                  markers={markers}
                  fps={extractFps}
                />
                <div ref={filmstripRef}
                  className="flex gap-1 overflow-x-auto pb-1">
                  {frames.map((f, i) => (
                    <button key={i} onClick={() => setCurrentFrame(i)}
                      className={cn(
                        "relative shrink-0 rounded overflow-hidden border-2 transition-colors",
                        i === currentFrame ? "border-primary" : "border-transparent hover:border-border"
                      )}>
                      <img src={f.dataUrl} alt="" className="h-14 w-auto object-cover" />
                      {editedFrameSet.has(f.index) && (
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-orange-400" />
                      )}
                      <div className="absolute bottom-0 inset-x-0 text-[8px] font-mono text-center bg-black/60 text-white py-0.5">{i}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
