import { useState, useRef, useCallback, useEffect } from "react";
import { Project, useCreateFrameEdit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ScanFace, Upload, Play, ChevronLeft, ChevronRight,
  RefreshCw, CheckCircle2, AlertTriangle, Loader2,
  Crosshair, Shield, Sliders, Info, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { useFaceSync, FrameFaceData } from "@/hooks/use-face-sync";

interface Props {
  project: Project;
}

function DriftBar({ score }: { score: number }) {
  const color =
    score === 0
      ? "bg-muted"
      : score < 20
      ? "bg-green-500"
      : score < 45
      ? "bg-yellow-500"
      : score < 70
      ? "bg-orange-500"
      : "bg-red-500";
  return (
    <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, score)}%` }}
      />
    </div>
  );
}

function DriftLabel({ score }: { score: number }) {
  if (score === 0) return <span className="text-muted-foreground">—</span>;
  if (score < 20) return <span className="text-green-400">Stable</span>;
  if (score < 45) return <span className="text-yellow-400">Drift</span>;
  if (score < 70) return <span className="text-orange-400">High Drift</span>;
  return <span className="text-red-400">Severe</span>;
}

function FrameThumb({
  frame,
  isRef,
  isSelected,
  threshold,
  onClick,
}: {
  frame: FrameFaceData;
  isRef: boolean;
  isSelected: boolean;
  threshold: number;
  onClick: () => void;
}) {
  const needsRestore = frame.driftScore >= threshold && !frame.restored;
  const wasRestored = frame.restored;

  return (
    <div
      className={`relative cursor-pointer rounded overflow-hidden border transition-all ${
        isSelected
          ? "border-primary ring-1 ring-primary"
          : isRef
          ? "border-blue-500"
          : wasRestored
          ? "border-green-500/60"
          : needsRestore
          ? "border-orange-500/60"
          : "border-border/40"
      }`}
      style={{ width: 72, height: 48, flexShrink: 0 }}
      onClick={onClick}
    >
      <img
        src={frame.restoredDataUrl ?? frame.dataUrl}
        alt={`Frame ${frame.frameIndex}`}
        className="w-full h-full object-cover"
      />
      {isRef && (
        <div className="absolute top-0.5 left-0.5 bg-blue-500 text-white text-[9px] px-1 rounded font-mono leading-tight">
          REF
        </div>
      )}
      {wasRestored && (
        <div className="absolute top-0.5 right-0.5 text-green-400">
          <CheckCircle2 className="w-3 h-3" />
        </div>
      )}
      {needsRestore && (
        <div className="absolute top-0.5 right-0.5 text-orange-400">
          <AlertTriangle className="w-3 h-3" />
        </div>
      )}
      {!frame.landmarks && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-[9px] text-muted-foreground">No face</span>
        </div>
      )}
    </div>
  );
}

export function FaceSyncStudio({ project }: Props) {
  const queryClient = useQueryClient();
  const { state, analyzeVideo, setReferenceFrame, restoreFrames, clearRestoration, reset } = useFaceSync();
  const createFrameEdit = useCreateFrameEdit();

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [threshold, setThreshold] = useState(30);
  const [strength, setStrength] = useState(0.85);
  const [showOriginal, setShowOriginal] = useState(false);
  const [analysisFps, setAnalysisFps] = useState(2);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const selectedFrame = state.frames[selectedIdx] ?? null;
  const refFrame = state.frames[state.referenceIdx] ?? null;

  const driftFrames = state.frames.filter((f) => f.driftScore >= threshold);
  const restoredCount = state.frames.filter((f) => f.restored).length;

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      reset();
      setSavedCount(0);
      analyzeVideo(file, analysisFps, 150);
    },
    [analyzeVideo, analysisFps, reset]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleRestoreAll = useCallback(() => {
    restoreFrames(threshold, strength);
  }, [restoreFrames, threshold, strength]);

  const handleSaveEdits = useCallback(async () => {
    const toSave = state.frames.filter((f) => f.restored && f.restoredDataUrl);
    if (!toSave.length) return;
    setIsSaving(true);
    let count = 0;
    for (const f of toSave) {
      try {
        await createFrameEdit.mutateAsync({
          id: project.id,
          data: {
            frameIndex: f.frameIndex,
            editType: "replace",
            sourceId: undefined,
            replacementDataUrl: f.restoredDataUrl!,
          },
        });
        count++;
      } catch {
        // skip frame on error
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["listFrameEdits", project.id] });
    setSavedCount(count);
    setIsSaving(false);
  }, [state.frames, project.id, createFrameEdit, queryClient]);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      setSelectedIdx((i) => Math.max(0, Math.min(state.frames.length - 1, i + dir)));
    },
    [state.frames.length]
  );

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const thumb = el.children[selectedIdx] as HTMLElement;
    if (thumb) thumb.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, [selectedIdx]);

  const isAnalyzing =
    state.phase === "extracting" || state.phase === "analyzing";
  const isRestoring = state.phase === "restoring";
  const isDone = state.phase === "done";

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0 gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Crosshair className="w-3.5 h-3.5" />
          <span className="text-foreground font-semibold">FaceSync</span>
          <span className="text-muted-foreground/60">·</span>
          <span>AI Face Drift Restoration</span>
        </div>
        <div className="flex-1" />
        {isDone && state.frames.length > 0 && (
          <>
            <Badge variant="outline" className="font-mono text-xs">
              {state.frames.length} frames
            </Badge>
            <Badge
              variant="outline"
              className={`font-mono text-xs ${driftFrames.length ? "border-orange-500/50 text-orange-400" : "border-green-500/50 text-green-400"}`}
            >
              {driftFrames.length} drifted
            </Badge>
            {restoredCount > 0 && (
              <Badge variant="outline" className="font-mono text-xs border-green-500/50 text-green-400">
                {restoredCount} restored
              </Badge>
            )}
          </>
        )}
        {isDone && restoredCount > 0 && !isSaving && savedCount === 0 && (
          <Button size="sm" className="h-8 text-xs font-mono bg-primary/90" onClick={handleSaveEdits}>
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Save {restoredCount} Edits
          </Button>
        )}
        {savedCount > 0 && (
          <Badge className="font-mono text-xs bg-green-600/20 text-green-400 border-green-600/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {savedCount} saved
          </Badge>
        )}
        {state.phase !== "idle" && (
          <Button variant="ghost" size="sm" className="h-8 text-xs font-mono" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Upload / Settings */}
        <div className="w-64 border-r border-border flex flex-col overflow-y-auto shrink-0 bg-sidebar/20">
          {/* Upload */}
          <div className="p-3 border-b border-border">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Upload className="w-3 h-3" /> Source Video
            </div>
            <div
              ref={dropRef}
              className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <Play className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">
                Drop video or click
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Settings */}
          <div className="p-3 border-b border-border space-y-3">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Analysis Settings
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Analysis rate</span>
                <span className="font-mono text-foreground">{analysisFps} fps</span>
              </div>
              <Slider
                min={1} max={5} step={1}
                value={[analysisFps]}
                onValueChange={([v]) => setAnalysisFps(v)}
                className="h-1"
                disabled={isAnalyzing}
              />
              <p className="text-[9px] text-muted-foreground/60">Higher = more frames analyzed, slower</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Drift threshold</span>
                <span className="font-mono text-foreground">{threshold}</span>
              </div>
              <Slider
                min={10} max={80} step={5}
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v)}
                className="h-1"
              />
              <p className="text-[9px] text-muted-foreground/60">Flag frames above this drift score</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Restoration blend</span>
                <span className="font-mono text-foreground">{Math.round(strength * 100)}%</span>
              </div>
              <Slider
                min={40} max={100} step={5}
                value={[Math.round(strength * 100)]}
                onValueChange={([v]) => setStrength(v / 100)}
                className="h-1"
              />
              <p className="text-[9px] text-muted-foreground/60">How strongly to apply reference face</p>
            </div>
          </div>

          {/* Reference frame info */}
          {refFrame && (
            <div className="p-3 border-b border-border space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Info className="w-3 h-3" /> Reference Face
              </div>
              <div className="relative rounded overflow-hidden border border-blue-500/50">
                <img src={refFrame.dataUrl} alt="Reference" className="w-full object-contain max-h-28" />
                {refFrame.landmarks && refFrame.faceBounds && (
                  <ReferenceFaceOverlay frame={refFrame} />
                )}
              </div>
              {refFrame.landmarks ? (
                <p className="text-[9px] text-blue-400">
                  Face detected · {refFrame.landmarks.length} landmarks
                </p>
              ) : (
                <p className="text-[9px] text-orange-400">No face detected in reference</p>
              )}
              <p className="text-[9px] text-muted-foreground/60">
                Click a frame in the strip to change reference
              </p>
            </div>
          )}

          {/* Restore action */}
          {isDone && driftFrames.length > 0 && (
            <div className="p-3">
              <Button
                className="w-full h-8 text-xs font-mono"
                onClick={handleRestoreAll}
                disabled={isRestoring}
              >
                {isRestoring ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Restoring…</>
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Restore {driftFrames.length} Frames</>
                )}
              </Button>
              <p className="text-[9px] text-muted-foreground/60 mt-1.5 text-center">
                Warps reference face onto drifted frames
              </p>
            </div>
          )}
        </div>

        {/* Center: main viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {state.phase === "idle" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground space-y-3 max-w-sm">
                <Crosshair className="w-12 h-12 mx-auto opacity-20" />
                <p className="text-sm font-medium">FaceSync Studio</p>
                <p className="text-xs leading-relaxed opacity-70">
                  Upload an AI-generated video to detect facial drift — where the
                  character's face changes between frames — and automatically
                  restore the original face appearance using reference frame
                  landmark alignment.
                </p>
              </div>
            </div>
          )}

          {(isAnalyzing || isRestoring) && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 w-64">
                <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                <div>
                  <p className="text-sm font-mono font-medium">
                    {state.phase === "extracting"
                      ? "Extracting frames…"
                      : state.phase === "analyzing"
                      ? "Analyzing faces…"
                      : "Restoring faces…"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {state.phase === "analyzing"
                      ? `Running MediaPipe FaceLandmarker`
                      : state.phase === "restoring"
                      ? `Warping reference face · ${driftFrames.length} frames`
                      : `Video → frames @ ${analysisFps}fps`}
                  </p>
                </div>
                <Progress value={state.progress} className="h-1.5" />
                <p className="text-xs font-mono text-muted-foreground">{state.progress}%</p>
              </div>
            </div>
          )}

          {state.phase === "error" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-red-400 space-y-2">
                <AlertTriangle className="w-8 h-8 mx-auto" />
                <p className="text-sm">{state.error}</p>
                <Button variant="outline" size="sm" className="text-xs" onClick={reset}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {isDone && selectedFrame && (
            <>
              {/* Frame viewer */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
                <div className="relative w-full max-w-2xl">
                  <img
                    src={
                      showOriginal || !selectedFrame.restoredDataUrl
                        ? selectedFrame.dataUrl
                        : selectedFrame.restoredDataUrl
                    }
                    alt={`Frame ${selectedFrame.frameIndex}`}
                    className="w-full rounded border border-border/50 object-contain max-h-[55vh]"
                  />

                  {/* Drift score overlay */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    {selectedFrame.frameIndex === state.referenceIdx ? (
                      <Badge className="bg-blue-600/80 text-white text-[10px] font-mono">
                        Reference Frame
                      </Badge>
                    ) : selectedFrame.driftScore > 0 ? (
                      <Badge
                        className={`text-[10px] font-mono ${
                          selectedFrame.driftScore >= threshold
                            ? "bg-orange-600/80 text-white"
                            : "bg-card/80 text-muted-foreground"
                        }`}
                      >
                        Drift: {selectedFrame.driftScore}
                      </Badge>
                    ) : null}
                    {selectedFrame.restored && (
                      <Badge className="bg-green-600/80 text-white text-[10px] font-mono">
                        ✓ Restored
                      </Badge>
                    )}
                  </div>

                  {/* Before/after toggle */}
                  {selectedFrame.restoredDataUrl && (
                    <div className="absolute top-2 right-2 flex">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] font-mono rounded-r-none border-r-0"
                        style={{ background: showOriginal ? "var(--primary)" : undefined }}
                        onMouseDown={() => setShowOriginal(true)}
                        onMouseUp={() => setShowOriginal(false)}
                        onMouseLeave={() => setShowOriginal(false)}
                      >
                        Original
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] font-mono rounded-l-none"
                        style={{ background: !showOriginal ? "var(--primary)" : undefined }}
                      >
                        Restored
                      </Button>
                    </div>
                  )}

                  {/* Set as reference button */}
                  {selectedFrame.frameIndex !== state.referenceIdx && selectedFrame.landmarks && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 left-2 h-6 text-[10px] font-mono"
                      onClick={() => setReferenceFrame(selectedFrame.frameIndex)}
                    >
                      Set as Reference
                    </Button>
                  )}

                  {/* Clear restoration */}
                  {selectedFrame.restored && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 right-2 h-6 text-[10px] font-mono text-orange-400 border-orange-500/30"
                      onClick={() => clearRestoration(selectedFrame.frameIndex)}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Frame meta */}
                <div className="mt-2 flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                  <span>Frame {selectedFrame.frameIndex}</span>
                  <span>{selectedFrame.timestamp.toFixed(2)}s</span>
                  {selectedFrame.landmarks && (
                    <span className="text-green-400">
                      Face ✓ ({selectedFrame.landmarks.length} pts)
                    </span>
                  )}
                  {!selectedFrame.landmarks && (
                    <span className="text-orange-400">No face detected</span>
                  )}
                  {selectedFrame.driftScore > 0 && (
                    <span>
                      Drift: <DriftLabel score={selectedFrame.driftScore} />
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center px-4 pb-2 gap-2 shrink-0">
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => navigate(-1)}
                  disabled={selectedIdx === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono text-muted-foreground">
                  {selectedIdx + 1} / {state.frames.length}
                </span>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => navigate(1)}
                  disabled={selectedIdx === state.frames.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Right: Drift chart */}
        {isDone && state.frames.length > 0 && (
          <div className="w-52 border-l border-border flex flex-col overflow-hidden shrink-0 bg-sidebar/10">
            <div className="p-3 border-b border-border">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Drift Map
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                <span className="text-foreground font-mono">{driftFrames.length}</span> frames need attention
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {state.frames.map((f, i) => (
                <div
                  key={f.frameIndex}
                  className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer transition-colors ${
                    i === selectedIdx
                      ? "bg-primary/10 border border-primary/20"
                      : f.frameIndex === state.referenceIdx
                      ? "bg-blue-500/10"
                      : "hover:bg-card/50"
                  }`}
                  onClick={() => setSelectedIdx(i)}
                >
                  <span className="text-[9px] font-mono text-muted-foreground w-5 shrink-0">
                    {f.frameIndex}
                  </span>
                  <DriftBar score={f.driftScore} />
                  <span className="text-[9px] font-mono w-6 text-right shrink-0">
                    {f.frameIndex === state.referenceIdx ? (
                      <span className="text-blue-400">ref</span>
                    ) : f.restored ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className={f.driftScore >= threshold ? "text-orange-400" : "text-muted-foreground"}>
                        {f.driftScore}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="p-3 border-t border-border space-y-1">
              <div className="text-[9px] text-muted-foreground font-mono space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-1.5 rounded-full bg-green-500" />
                  <span>{"< 20 Stable"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-1.5 rounded-full bg-yellow-500" />
                  <span>20–44 Drift</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-1.5 rounded-full bg-orange-500" />
                  <span>45–69 High</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-1.5 rounded-full bg-red-500" />
                  <span>70+ Severe</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Film strip */}
      {isDone && state.frames.length > 0 && (
        <div className="h-16 border-t border-border bg-sidebar/20 flex items-center px-3 gap-2 shrink-0">
          <div
            ref={stripRef}
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1"
          >
            {state.frames.map((f, i) => (
              <FrameThumb
                key={f.frameIndex}
                frame={f}
                isRef={f.frameIndex === state.referenceIdx}
                isSelected={i === selectedIdx}
                threshold={threshold}
                onClick={() => {
                  setSelectedIdx(i);
                  if (f.landmarks) setReferenceFrame(f.frameIndex);
                }}
              />
            ))}
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving edits…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReferenceFaceOverlay({ frame }: { frame: FrameFaceData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame.faceBounds || !frame.eyeLeft || !frame.eyeRight) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const img = new Image();
    img.src = frame.dataUrl;
    img.onload = () => {
      const scaleX = canvas.width / img.naturalWidth;
      const scaleY = canvas.height / img.naturalHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (frame.faceBounds) {
        const { x, y, w, h } = frame.faceBounds;
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
        ctx.setLineDash([]);
      }

      const drawDot = (pt: { x: number; y: number }, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt.x * scaleX, pt.y * scaleY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      };

      if (frame.eyeLeft) drawDot(frame.eyeLeft, "#60a5fa");
      if (frame.eyeRight) drawDot(frame.eyeRight, "#60a5fa");
      if (frame.noseTip) drawDot(frame.noseTip, "#34d399");
    };
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
