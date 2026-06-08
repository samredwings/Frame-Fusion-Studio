import { useState, useRef, useCallback, useEffect } from "react";
import { VideoSource, Project, BlurRegion, useCreateBlurRegion, useListBlurRegions, useUpdateBlurRegion, useDeleteBlurRegion } from "@workspace/api-client-react";
import { ScanFace, MousePointer2, EyeOff, Eye, Trash2, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Timeline } from "./timeline";
import { useFFmpeg } from "@/hooks/use-ffmpeg";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface BlurStudioProps {
  project: Project;
  sources: VideoSource[];
}

type DrawRect = { x: number; y: number; w: number; h: number };
type DrawMode = "draw" | "select";

const BLUR_COLORS = ["#ff6b35", "#7c3aed", "#0ea5e9", "#10b981", "#f59e0b"];

export function BlurStudio({ project, sources }: BlurStudioProps) {
  const queryClient = useQueryClient();
  const primarySource = sources.find((s) => s.role === "primary") ?? sources[0];

  const [frames, setFrames] = useState<{ index: number; timestamp: number; dataUrl: string }[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [drawMode, setDrawMode] = useState<DrawMode>("select");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [pendingRect, setPendingRect] = useState<DrawRect | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showMasked, setShowMasked] = useState(true);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [frameStart, setFrameStart] = useState(0);
  const [frameEnd, setFrameEnd] = useState(0);
  const [labelInput, setLabelInput] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const { isProcessing, progress, extractFrames, load } = useFFmpeg();
  const createBlur = useCreateBlurRegion();
  const { data: blurRegions } = useListBlurRegions(project.id);
  const updateBlur = useUpdateBlurRegion();
  const deleteBlur = useDeleteBlurRegion();

  const activeRegions = (blurRegions ?? []).filter(
    (r) => frames[currentFrame] !== undefined
      ? r.frameStart <= frames[currentFrame].index && r.frameEnd >= frames[currentFrame].index
      : true
  );

  const handleFileLoad = useCallback(async (file: File) => {
    setLocalFile(file);
    await load();
    const extracted = await extractFrames(file, { fps: 2, maxFrames: 60 });
    setFrames(extracted);
    setCurrentFrame(0);
    setFrameEnd(extracted.length - 1);
  }, [load, extractFrames]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !frames[currentFrame]) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth || img.clientWidth;
    canvas.height = img.naturalHeight || img.clientHeight;

    if (showMasked) {
      const regions = (blurRegions ?? []).filter(
        (r) => r.frameStart <= frames[currentFrame].index && r.frameEnd >= frames[currentFrame].index && r.masked
      );
      regions.forEach((r) => {
        const x = (r.x / 100) * canvas.width;
        const y = (r.y / 100) * canvas.height;
        const w = (r.width / 100) * canvas.width;
        const h = (r.height / 100) * canvas.height;
        ctx.save();
        ctx.filter = "blur(12px)";
        ctx.drawImage(img, x, y, w, h, x, y, w, h);
        ctx.restore();
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      });
    }

    if (pendingRect) {
      const x = (pendingRect.x / 100) * canvas.width;
      const y = (pendingRect.y / 100) * canvas.height;
      const w = (pendingRect.w / 100) * canvas.width;
      const h = (pendingRect.h / 100) * canvas.height;
      ctx.strokeStyle = "#ff6b35";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [frames, currentFrame, blurRegions, showMasked, pendingRect]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawMode !== "draw") return;
    e.preventDefault();
    const pos = getCanvasCoords(e);
    setDragStart(pos);
    setIsDragging(true);
    setPendingRect(null);
  }, [drawMode, getCanvasCoords]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || drawMode !== "draw") return;
    const pos = getCanvasCoords(e);
    setPendingRect({
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    });
  }, [isDragging, dragStart, drawMode, getCanvasCoords]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleSaveRegion = useCallback(async () => {
    if (!pendingRect || pendingRect.w < 1 || pendingRect.h < 1) return;
    await createBlur.mutateAsync({
      id: project.id,
      data: {
        label: labelInput || `Region ${(blurRegions?.length ?? 0) + 1}`,
        blurType: "gaussian",
        x: pendingRect.x,
        y: pendingRect.y,
        width: pendingRect.w,
        height: pendingRect.h,
        frameStart: frames[frameStart]?.index ?? 0,
        frameEnd: frames[frameEnd]?.index ?? frames.length - 1,
        trackingEnabled: true,
        masked: true,
      },
    });
    await queryClient.invalidateQueries({ queryKey: ["listBlurRegions", project.id] });
    setPendingRect(null);
    setLabelInput("");
  }, [pendingRect, project.id, createBlur, blurRegions, labelInput, frames, frameStart, frameEnd, queryClient]);

  const handleAutoDetect = useCallback(async () => {
    if (!frames[currentFrame]) return;
    setIsDetecting(true);
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      const faceDetector = await FaceDetector.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
      });

      const img = new Image();
      img.src = frames[currentFrame].dataUrl;
      await new Promise((r) => { img.onload = r; });

      const result = faceDetector.detect(img);
      faceDetector.close();

      for (const det of result.detections) {
        const box = det.boundingBox;
        if (!box) continue;
        const pw = 100 / img.naturalWidth;
        const ph = 100 / img.naturalHeight;
        const padding = 0.15;
        const x = Math.max(0, (box.originX / img.naturalWidth - padding) * 100);
        const y = Math.max(0, (box.originY / img.naturalHeight - padding) * 100);
        const w = Math.min(100 - x, (box.width / img.naturalWidth + padding * 2) * 100);
        const h = Math.min(100 - y, (box.height / img.naturalHeight + padding * 2) * 100);
        if (w > 1 && h > 1) {
          await createBlur.mutateAsync({
            projectId: project.id,
            data: {
              label: `Face ${(blurRegions?.length ?? 0) + 1}`,
              blurType: "gaussian",
              x, y, width: w, height: h,
              frameStart: frames[frameStart]?.index ?? 0,
              frameEnd: frames[frameEnd]?.index ?? frames.length - 1,
              trackingEnabled: true,
              masked: true,
            },
          });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["listProjectBlurRegions", project.id] });
    } catch (e) {
      console.error("Face detection failed:", e);
    } finally {
      setIsDetecting(false);
    }
  }, [frames, currentFrame, project.id, createBlur, blurRegions, frameStart, frameEnd, queryClient]);

  const toggleMask = useCallback(async (regionId: number, masked: boolean) => {
    await updateBlur.mutateAsync({ id: project.id, regionId, data: { masked } });
    await queryClient.invalidateQueries({ queryKey: ["listBlurRegions", project.id] });
  }, [project.id, updateBlur, queryClient]);

  const handleDelete = useCallback(async (regionId: number) => {
    await deleteBlur.mutateAsync({ id: project.id, regionId });
    await queryClient.invalidateQueries({ queryKey: ["listBlurRegions", project.id] });
  }, [project.id, deleteBlur, queryClient]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono"
            onClick={handleAutoDetect} disabled={isDetecting || !frames.length}>
            {isDetecting
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Detecting…</>
              : <><ScanFace className="w-3.5 h-3.5 mr-1.5" />Auto-Detect Faces</>}
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button
            variant={drawMode === "draw" ? "default" : "ghost"}
            size="sm" className="h-8 text-xs font-mono"
            onClick={() => setDrawMode((m) => m === "draw" ? "select" : "draw")}>
            <MousePointer2 className="w-3.5 h-3.5 mr-1.5" />
            {drawMode === "draw" ? "Drawing…" : "Draw Region"}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs font-mono"
            onClick={() => setShowMasked((v) => !v)}>
            {showMasked ? <Eye className="w-3.5 h-3.5 mr-1.5" /> : <EyeOff className="w-3.5 h-3.5 mr-1.5" />}
            {showMasked ? "Preview On" : "Preview Off"}
          </Button>
        </div>
        {!localFile && (
          <label className="cursor-pointer">
            <input type="file" accept="video/*" className="sr-only"
              onChange={(e) => e.target.files?.[0] && handleFileLoad(e.target.files[0])} />
            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono pointer-events-none">
              <span><Wand2 className="w-3.5 h-3.5 mr-1.5" />Load Video</span>
            </Button>
          </label>
        )}
      </div>

      {isProcessing && <Progress value={progress} className="h-0.5 rounded-none" />}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: regions */}
        <div className="w-60 border-r border-border bg-sidebar/50 p-3 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Blur Regions</h3>

          {(blurRegions ?? []).length === 0 && (
            <div className="text-center p-3 border border-dashed border-border/50 rounded text-muted-foreground text-xs">
              {frames.length ? "Draw or auto-detect regions" : "Load a video to begin"}
            </div>
          )}

          {(blurRegions ?? []).map((r, i) => (
            <div key={r.id}
              className={cn(
                "p-2 rounded border text-xs font-mono transition-colors",
                activeRegions.some((a) => a.id === r.id) ? "border-purple-400/50 bg-purple-400/5" : "border-border/30"
              )}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: BLUR_COLORS[i % BLUR_COLORS.length] }} />
                  <span className="truncate max-w-[100px]">{r.label}</span>
                </span>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-5 w-5"
                    onClick={() => toggleMask(r.id, !r.masked)}>
                    {r.masked ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-400"
                    onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Frames {r.frameStart}–{r.frameEnd} · {r.blurType}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {r.x.toFixed(1)}%,{r.y.toFixed(1)}% {r.width.toFixed(1)}×{r.height.toFixed(1)}
              </div>
            </div>
          ))}

          {pendingRect && pendingRect.w > 1 && (
            <div className="p-2 rounded border border-orange-400/40 bg-orange-400/5 space-y-2">
              <p className="text-xs font-mono text-orange-400">New Region</p>
              <input
                className="w-full h-7 px-2 text-xs font-mono bg-background border border-border rounded"
                placeholder="Label (optional)"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
              />
              <div className="flex gap-1.5 text-xs font-mono text-muted-foreground">
                <span>f{frameStart}–</span>
                <input type="number" min={0} max={frames.length - 1} value={frameEnd}
                  className="w-14 h-6 px-1 bg-background border border-border rounded"
                  onChange={(e) => setFrameEnd(Number(e.target.value))} />
              </div>
              <Button size="sm" className="w-full h-7 text-xs font-mono" onClick={handleSaveRegion}>
                Save Region
              </Button>
            </div>
          )}
        </div>

        {/* Canvas view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!frames.length ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <ScanFace className="w-10 h-10 opacity-30" />
              <p className="text-sm font-mono">Load a video to start adding blur regions</p>
              <label className="cursor-pointer mt-2">
                <input type="file" accept="video/*" className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleFileLoad(e.target.files[0])} />
                <Button asChild variant="outline" size="sm" className="pointer-events-none font-mono">
                  <span>Browse Video</span>
                </Button>
              </label>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={cn(
                "flex-1 flex items-center justify-center bg-black/40 relative overflow-hidden",
                drawMode === "draw" && "cursor-crosshair"
              )}>
                <div className="relative">
                  <img
                    ref={imgRef}
                    src={frames[currentFrame]?.dataUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    onLoad={renderCanvas}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ mixBlendMode: showMasked ? "normal" : "screen" }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                  />
                </div>
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {drawMode === "draw" && (
                    <Badge className="bg-orange-500/90 text-white text-[10px] font-mono border-0">DRAW MODE</Badge>
                  )}
                  {activeRegions.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {activeRegions.length} region{activeRegions.length !== 1 ? "s" : ""} active
                    </Badge>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t border-border bg-background/80 p-3 shrink-0">
                <Timeline
                  totalFrames={frames.length}
                  currentFrame={currentFrame}
                  onSeek={setCurrentFrame}
                  markers={(blurRegions ?? []).flatMap((r) =>
                    frames
                      .filter((f) => f.index >= r.frameStart && f.index <= r.frameEnd)
                      .map((f) => ({ frameIndex: frames.indexOf(f), type: "blur" as const, label: r.label }))
                  )}
                  fps={2}
                />
                <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
                  {frames.map((f, i) => (
                    <button key={i} onClick={() => setCurrentFrame(i)}
                      className={cn(
                        "relative shrink-0 rounded overflow-hidden border-2 transition-colors",
                        i === currentFrame ? "border-purple-400" : "border-transparent hover:border-border"
                      )}>
                      <img src={f.dataUrl} alt="" className="h-12 w-auto object-cover" />
                      {(blurRegions ?? []).some((r) => r.frameStart <= f.index && r.frameEnd >= f.index) && (
                        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-purple-400" />
                      )}
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
