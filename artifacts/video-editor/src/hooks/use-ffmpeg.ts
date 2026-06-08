import { useState, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export type ExtractedFrame = {
  index: number;
  timestamp: number;
  dataUrl: string;
};

export type VideoInfo = {
  fps: number;
  duration: number;
  width: number;
  height: number;
  frameCount: number;
};

const FFMPEG_CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

let _instance: FFmpeg | null = null;
let _loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpegInstance(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (_instance?.loaded) {
    if (onProgress) _instance.on("progress", ({ progress }) => onProgress(Math.round(progress * 100)));
    return _instance;
  }
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      _instance = ffmpeg;
      return ffmpeg;
    })();
  }
  const ffmpeg = await _loadPromise;
  if (onProgress) ffmpeg.on("progress", ({ progress }) => onProgress(Math.round(progress * 100)));
  return ffmpeg;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export function useFFmpeg() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isLoaded) return;
    setIsLoading(true);
    setError(null);
    try {
      await getFFmpegInstance();
      setIsLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load FFmpeg WASM");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded]);

  const getVideoInfo = useCallback(async (file: File): Promise<VideoInfo> => {
    const ffmpeg = await getFFmpegInstance();
    let logOutput = "";
    const unsub = ffmpeg.on("log", ({ message }) => { logOutput += message + "\n"; });
    const ext = file.name.split(".").pop() ?? "mp4";
    const inputName = `probe.${ext}`;
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    try { await ffmpeg.exec(["-i", inputName]); } catch { /* expected */ }
    (unsub as unknown as () => void)?.();
    await ffmpeg.deleteFile(inputName).catch(() => {});

    const fpsMatch = logOutput.match(/(\d+(?:\.\d+)?)\s+fps/);
    const durMatch = logOutput.match(/Duration:\s+(\d+):(\d+):(\d+\.?\d*)/);
    const dimMatch = logOutput.match(/,\s*(\d{2,5})x(\d{2,5})/);

    const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 30;
    const duration = durMatch
      ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3])
      : 0;
    const width = dimMatch ? parseInt(dimMatch[1]) : 1920;
    const height = dimMatch ? parseInt(dimMatch[2]) : 1080;

    return { fps, duration, width, height, frameCount: Math.round(fps * duration) };
  }, []);

  const extractFrames = useCallback(async (
    file: File,
    opts: {
      fps?: number;
      maxFrames?: number;
      startSec?: number;
      endSec?: number;
      onProgress?: (p: number) => void;
    } = {}
  ): Promise<ExtractedFrame[]> => {
    const { fps = 1, maxFrames = 120, startSec, endSec, onProgress } = opts;
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    try {
      const ffmpeg = await getFFmpegInstance((p) => { setProgress(p); onProgress?.(p); });
      const ext = file.name.split(".").pop() ?? "mp4";
      const inputName = `input.${ext}`;
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const args: string[] = ["-i", inputName];
      if (startSec !== undefined) args.push("-ss", String(startSec));
      if (endSec !== undefined) args.push("-to", String(endSec));
      args.push("-vf", `fps=${fps}`, "-vframes", String(maxFrames), "frame_%04d.png");

      await ffmpeg.exec(args);
      await ffmpeg.deleteFile(inputName).catch(() => {});

      const frames: ExtractedFrame[] = [];
      for (let i = 1; i <= maxFrames; i++) {
        const name = `frame_${String(i).padStart(4, "0")}.png`;
        try {
          const data = await ffmpeg.readFile(name) as Uint8Array;
          const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
          const dataUrl = await blobToDataUrl(blob);
          frames.push({ index: i - 1, timestamp: (i - 1) / fps + (startSec ?? 0), dataUrl });
          await ffmpeg.deleteFile(name).catch(() => {});
        } catch {
          break;
        }
      }
      setProgress(100);
      return frames;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Frame extraction failed");
      return [];
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const encodeVideo = useCallback(async (
    frames: string[],
    fps: number,
    opts: {
      format?: "mp4" | "webm" | "gif";
      crf?: number;
      width?: number;
      height?: number;
      onProgress?: (p: number) => void;
    } = {}
  ): Promise<Blob | null> => {
    const { format = "mp4", crf = 23, width, height, onProgress } = opts;
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    try {
      const ffmpeg = await getFFmpegInstance((p) => { setProgress(p); onProgress?.(p); });

      for (let i = 0; i < frames.length; i++) {
        const data = dataUrlToUint8Array(frames[i]);
        await ffmpeg.writeFile(`enc_${String(i + 1).padStart(4, "0")}.png`, data);
      }

      const outputName = `output.${format}`;
      const scaleFilter = width && height ? `,scale=${width}:${height}` : "";
      const args: string[] = ["-framerate", String(fps), "-i", "enc_%04d.png"];

      if (format === "mp4") {
        if (scaleFilter) args.push("-vf", `scale=${width}:${height}`);
        args.push("-c:v", "libx264", "-crf", String(crf), "-pix_fmt", "yuv420p");
      } else if (format === "webm") {
        if (scaleFilter) args.push("-vf", `scale=${width}:${height}`);
        args.push("-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0");
      } else {
        const paletteFilter = `fps=${fps}${scaleFilter},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
        args.push("-vf", paletteFilter, "-loop", "0");
      }

      args.push("-y", outputName);
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(outputName) as Uint8Array;
      for (let i = 0; i < frames.length; i++) {
        await ffmpeg.deleteFile(`enc_${String(i + 1).padStart(4, "0")}.png`).catch(() => {});
      }
      await ffmpeg.deleteFile(outputName).catch(() => {});

      const mimeTypes: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", gif: "image/gif" };
      setProgress(100);
      return new Blob([data], { type: mimeTypes[format] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encoding failed");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { isLoaded, isLoading, isProcessing, progress, error, load, getVideoInfo, extractFrames, encodeVideo };
}
