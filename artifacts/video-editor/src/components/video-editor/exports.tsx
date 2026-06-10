import { useState, useCallback } from "react";
import { Project, BlurRegion, FrameEdit, useListSources, useListBlurRegions, useListFrameEdits } from "@workspace/api-client-react";
import { Download, UploadCloud, FileVideo, Settings2, Loader2, CheckCircle2, AlertCircle, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useFFmpeg } from "@/hooks/use-ffmpeg";
import { cn } from "@/lib/utils";

interface ExportsPanelProps {
  project: Project;
}

type ExportFormat = "mp4" | "webm" | "gif";
type Resolution = "source" | "1080p" | "720p" | "480p";

const RESOLUTIONS: Record<Exclude<Resolution, "source">, [number, number]> = {
  "1080p": [1920, 1080],
  "720p": [1280, 720],
  "480p": [854, 480],
};

async function uploadToStorage(file: File | Blob, name: string): Promise<string> {
  const type = file instanceof File ? file.type : (file as Blob).type;
  const size = file instanceof File ? file.size : (file as Blob).size;
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size, contentType: type }),
  });
  if (!res.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await res.json() as { uploadURL: string; objectPath: string };
  await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": type } });
  return objectPath;
}

export function ExportsPanel({ project }: ExportsPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [resolution, setResolution] = useState<Resolution>("source");
  const [crf, setCrf] = useState(23);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "extracting" | "encoding" | "uploading" | "done" | "error">("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [cloudPath, setCloudPath] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { isLoaded: _il, isProcessing, progress, load, extractFrames, encodeVideo } = useFFmpeg();
  const { data: sources } = useListSources(project.id);
  const { data: blurRegions } = useListBlurRegions(project.id);
  const { data: frameEdits } = useListFrameEdits(project.id);

  const primarySource = sources?.find((s) => s.role === "primary") ?? sources?.[0];

  const handleExport = useCallback(async () => {
    if (!localFile) return;
    setStatus("extracting");
    setExportProgress(5);
    setErrorMsg(null);
    setOutputBlob(null);
    setCloudPath(null);

    try {
      await load();
      const fps = primarySource?.fps ?? 30;

      setExportProgress(10);
      const extracted = await extractFrames(localFile, {
        fps,
        maxFrames: 300,
        onProgress: (p) => setExportProgress(10 + p * 0.4),
      });

      if (!extracted.length) throw new Error("No frames extracted from video");

      // Apply frame edits (replacements)
      const edits = (frameEdits ?? []) as FrameEdit[];
      const editMap = new Map(edits.map((e) => [e.frameIndex, e.replacementDataUrl ?? null]));
      type ProcessedFrame = { index: number; timestamp: number; dataUrl: string };
      let processedFrames: ProcessedFrame[] = extracted.map((f) => {
        const replacement = editMap.get(f.index);
        return replacement ? { ...f, dataUrl: replacement } : f;
      });

      // Apply blur regions on each frame canvas
      const blurs = (blurRegions ?? []) as BlurRegion[];
      if (blurs.length > 0) {
        processedFrames = await Promise.all(
          processedFrames.map(async (f): Promise<ProcessedFrame> => {
            const activeBlurs = blurs.filter((b: BlurRegion) => b.masked && b.frameStart <= f.index && b.frameEnd >= f.index);
            if (!activeBlurs.length) return f;

            return new Promise<ProcessedFrame>((resolve) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0);

                activeBlurs.forEach((b: BlurRegion) => {
                  const x = ((b.x ?? 0) / 100) * canvas.width;
                  const y = ((b.y ?? 0) / 100) * canvas.height;
                  const w = ((b.width ?? 0) / 100) * canvas.width;
                  const h = ((b.height ?? 0) / 100) * canvas.height;
                  ctx.save();
                  ctx.filter = "blur(12px)";
                  ctx.drawImage(img, x, y, w, h, x, y, w, h);
                  ctx.restore();
                });

                resolve({ ...f, dataUrl: canvas.toDataURL("image/png") });
              };
              img.src = f.dataUrl;
            });
          })
        );
      }

      setExportProgress(60);
      setStatus("encoding");

      const res = resolution !== "source" ? RESOLUTIONS[resolution] : undefined;
      const blob = await encodeVideo(
        processedFrames.map((f) => f.dataUrl),
        fps,
        {
          format,
          crf,
          width: res?.[0],
          height: res?.[1],
          onProgress: (p) => setExportProgress(60 + p * 0.3),
        }
      );

      if (!blob) throw new Error("Encoding failed — no output produced");
      setOutputBlob(blob);
      setExportProgress(95);
      setStatus("done");
      setExportProgress(100);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Export failed");
      setStatus("error");
    }
  }, [localFile, primarySource, load, extractFrames, encodeVideo, frameEdits, blurRegions, format, resolution, crf]);

  const handleDownload = useCallback(() => {
    if (!outputBlob) return;
    const ext = format === "gif" ? "gif" : format;
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [outputBlob, format, project.name]);

  const handleCloudUpload = useCallback(async () => {
    if (!outputBlob) return;
    setStatus("uploading");
    try {
      const ext = format === "gif" ? "gif" : format;
      const filename = `${project.name.replace(/\s+/g, "_")}_export_${Date.now()}.${ext}`;
      const path = await uploadToStorage(outputBlob, filename);
      setCloudPath(path);
      setStatus("done");
    } catch {
      setErrorMsg("Cloud upload failed");
      setStatus("error");
    }
  }, [outputBlob, format, project.name]);

  const isWorking = ["extracting", "encoding", "uploading"].includes(status);
  const statsEdits = frameEdits?.length ?? 0;
  const statsBlur = blurRegions?.length ?? 0;
  const statsSources = sources?.length ?? 0;

  return (
    <div className="h-full w-full p-6 overflow-y-auto bg-background/50">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-mono uppercase mb-1">Final Export</h2>
          <p className="text-muted-foreground text-sm">Render all edits, blur regions, and frame replacements into a final video.</p>
        </div>

        {/* Project stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Sources", value: statsSources },
            { label: "Frame Edits", value: statsEdits },
            { label: "Blur Regions", value: statsBlur },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-mono font-bold text-primary">{value}</div>
              <div className="text-xs font-mono text-muted-foreground uppercase mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Source video */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileVideo className="w-4 h-4" />Source Video
            </CardTitle>
            <CardDescription className="text-xs">
              {primarySource ? `${primarySource.filename} · ${primarySource.fps ?? 30}fps · ${primarySource.totalFrames ?? "?"} frames` : "No primary source"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="cursor-pointer">
              <input type="file" accept="video/*" className="sr-only"
                onChange={(e) => e.target.files?.[0] && setLocalFile(e.target.files[0])} />
              <Button asChild variant="outline" size="sm" className="font-mono pointer-events-none">
                <span>
                  <UploadCloud className="w-3.5 h-3.5 mr-2" />
                  {localFile ? localFile.name.slice(0, 30) + (localFile.name.length > 30 ? "…" : "") : "Load Local Video File"}
                </span>
              </Button>
            </label>
          </CardContent>
        </Card>

        {/* Export settings */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-4 h-4" />Export Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground uppercase">Format</label>
                <select
                  className="w-full h-9 px-3 text-sm bg-background border border-border rounded"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}>
                  <option value="mp4">MP4 (H.264) — best compatibility</option>
                  <option value="webm">WebM (VP9) — smaller size</option>
                  <option value="gif">Animated GIF</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground uppercase">Resolution</label>
                <select
                  className="w-full h-9 px-3 text-sm bg-background border border-border rounded"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as Resolution)}>
                  <option value="source">Match Source</option>
                  <option value="1080p">1080p (1920×1080)</option>
                  <option value="720p">720p (1280×720)</option>
                  <option value="480p">480p (854×480)</option>
                </select>
              </div>
            </div>

            {format !== "gif" && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-mono text-muted-foreground uppercase">Quality (CRF)</label>
                  <span className="text-xs font-mono text-primary">{crf} — {crf < 20 ? "High" : crf < 30 ? "Medium" : "Low"}</span>
                </div>
                <input type="range" min={10} max={51} value={crf}
                  className="w-full accent-orange-400"
                  onChange={(e) => setCrf(Number(e.target.value))} />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>10 (lossless)</span><span>51 (smallest)</span>
                </div>
              </div>
            )}

            {isWorking && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span className="capitalize">{status}…</span>
                  <span>{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-1.5" />
              </div>
            )}

            {status === "done" && !isWorking && (
              <div className="flex items-center gap-2 p-3 rounded border border-green-400/30 bg-green-400/5 text-xs font-mono text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Export complete{cloudPath ? ` · Saved to cloud` : ""}
              </div>
            )}

            {status === "error" && (
              <div className="flex items-center gap-2 p-3 rounded border border-red-400/30 bg-red-400/5 text-xs font-mono text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <Button
              className="w-full font-mono uppercase tracking-wider"
              size="lg"
              onClick={handleExport}
              disabled={!localFile || isWorking}>
              {isWorking
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{status === "extracting" ? "Extracting frames…" : status === "encoding" ? `Encoding ${progress}%…` : "Uploading…"}</>
                : <><FileVideo className="w-4 h-4 mr-2" />Render Final Video</>}
            </Button>

            {outputBlob && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button variant="outline" className="font-mono text-sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />Download
                </Button>
                <Button variant="outline" className="font-mono text-sm"
                  onClick={handleCloudUpload} disabled={status === "uploading"}>
                  {status === "uploading"
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
                    : <><CloudUpload className="w-4 h-4 mr-2" />{cloudPath ? "Re-upload" : "Save to Cloud"}</>}
                </Button>
              </div>
            )}

            {cloudPath && (
              <div className="p-2 rounded border border-border/40 bg-card/50 text-[10px] font-mono text-muted-foreground break-all">
                ☁ {cloudPath}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
