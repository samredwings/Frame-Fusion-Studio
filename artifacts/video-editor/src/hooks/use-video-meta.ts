import { useState, useCallback } from "react";

export type VideoMeta = {
  fps: number;
  duration: number;
  width: number;
  height: number;
  frameCount: number;
  fileSize: number;
  filename: string;
};

function detectFpsViaFrameCallback(video: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    if (!("requestVideoFrameCallback" in video)) {
      resolve(30);
      return;
    }

    let frameCount = 0;
    const startTime = performance.now();
    const SAMPLE_DURATION_MS = 1000;

    const callback: VideoFrameRequestCallback = (now) => {
      frameCount++;
      if (now - startTime < SAMPLE_DURATION_MS) {
        video.requestVideoFrameCallback(callback);
      } else {
        const elapsed = (now - startTime) / 1000;
        const detected = Math.round(frameCount / elapsed);
        const common = [24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];
        const snapped = common.reduce((best, v) => Math.abs(v - detected) < Math.abs(best - detected) ? v : best, detected);
        resolve(snapped);
      }
    };

    video.requestVideoFrameCallback(callback);
    video.currentTime = 0;
    video.play().catch(() => resolve(30));

    setTimeout(() => {
      video.pause();
    }, SAMPLE_DURATION_MS + 500);
  });
}

export function useVideoMeta() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeFile = useCallback(async (file: File): Promise<VideoMeta> => {
    setIsAnalyzing(true);
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.muted = true;
      video.src = url;
      video.preload = "metadata";

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video metadata"));
        setTimeout(() => reject(new Error("Metadata load timeout")), 10000);
      });

      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      let fps = 30;
      try {
        fps = await detectFpsViaFrameCallback(video);
      } catch {
        fps = 30;
      } finally {
        video.pause();
        video.src = "";
        URL.revokeObjectURL(url);
      }

      const frameCount = Math.round(fps * duration);
      return {
        fps,
        duration,
        width,
        height,
        frameCount,
        fileSize: file.size,
        filename: file.name,
      };
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { analyzeFile, isAnalyzing };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 100);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
