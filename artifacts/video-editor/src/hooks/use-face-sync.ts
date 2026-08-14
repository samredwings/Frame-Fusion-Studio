import { useState, useCallback, useRef } from "react";

export type NormalizedLandmark = { x: number; y: number; z: number };

export type FrameFaceData = {
  frameIndex: number;
  timestamp: number;
  dataUrl: string;
  width: number;
  height: number;
  landmarks: NormalizedLandmark[] | null;
  driftScore: number;
  eyeLeft: { x: number; y: number } | null;
  eyeRight: { x: number; y: number } | null;
  noseTip: { x: number; y: number } | null;
  faceBounds: { x: number; y: number; w: number; h: number } | null;
  restored: boolean;
  restoredDataUrl: string | null;
};

export type FaceSyncPhase =
  | "idle"
  | "extracting"
  | "analyzing"
  | "restoring"
  | "done"
  | "error";

export type FaceSyncState = {
  phase: FaceSyncPhase;
  progress: number;
  frames: FrameFaceData[];
  referenceIdx: number;
  error: string | null;
  totalFrames: number;
};

const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// MediaPipe key landmark indices (FaceLandmarker 478-point model)
const IDX_LEFT_EYE_OUTER = 33;
const IDX_LEFT_EYE_INNER = 133;
const IDX_RIGHT_EYE_INNER = 362;
const IDX_RIGHT_EYE_OUTER = 263;
const IDX_NOSE_TIP = 4;
const IDX_CHIN = 152;

function lm(landmarks: NormalizedLandmark[], idx: number, w: number, h: number) {
  const p = landmarks[idx];
  if (!p) return null;
  return { x: p.x * w, y: p.y * h };
}

function avg(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function computeKeyPoints(landmarks: NormalizedLandmark[], w: number, h: number) {
  const leOuter = lm(landmarks, IDX_LEFT_EYE_OUTER, w, h);
  const leInner = lm(landmarks, IDX_LEFT_EYE_INNER, w, h);
  const reInner = lm(landmarks, IDX_RIGHT_EYE_INNER, w, h);
  const reOuter = lm(landmarks, IDX_RIGHT_EYE_OUTER, w, h);
  const nose = lm(landmarks, IDX_NOSE_TIP, w, h);
  const chin = lm(landmarks, IDX_CHIN, w, h);
  if (!leOuter || !leInner || !reInner || !reOuter || !nose || !chin) return null;

  const eyeLeft = avg(leOuter, leInner);
  const eyeRight = avg(reInner, reOuter);

  const xs = landmarks.map((p) => p.x * w);
  const ys = landmarks.map((p) => p.y * h);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    eyeLeft,
    eyeRight,
    noseTip: nose,
    chin,
    faceBounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

function computeDrift(
  refLandmarks: NormalizedLandmark[],
  tgtLandmarks: NormalizedLandmark[]
): number {
  if (refLandmarks.length !== tgtLandmarks.length) return 100;

  const refEyeL = refLandmarks[IDX_LEFT_EYE_OUTER];
  const refEyeR = refLandmarks[IDX_RIGHT_EYE_OUTER];
  if (!refEyeL || !refEyeR) return 100;
  const refScale = Math.hypot(refEyeR.x - refEyeL.x, refEyeR.y - refEyeL.y) || 1;

  const refNose = refLandmarks[IDX_NOSE_TIP];
  const tgtNose = tgtLandmarks[IDX_NOSE_TIP];
  if (!refNose || !tgtNose) return 100;

  let sumSq = 0;
  const count = refLandmarks.length;
  for (let i = 0; i < count; i++) {
    const rx = (refLandmarks[i].x - refNose.x) / refScale;
    const ry = (refLandmarks[i].y - refNose.y) / refScale;
    const tx = (tgtLandmarks[i].x - tgtNose.x) / refScale;
    const ty = (tgtLandmarks[i].y - tgtNose.y) / refScale;
    sumSq += (rx - tx) ** 2 + (ry - ty) ** 2;
  }
  const rmse = Math.sqrt(sumSq / count);
  return Math.min(100, Math.round(rmse * 1200));
}

async function extractFramesFromVideo(
  file: File,
  fps: number,
  maxFrames: number,
  onProgress: (pct: number) => void
): Promise<{ dataUrl: string; timestamp: number; width: number; height: number }[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const url = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(url);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error("Failed to read video"));
    };

    const seekTo = (time: number) =>
      new Promise<void>((resolveSeek, rejectSeek) => {
        let finished = false;
        const finish = (callback: () => void) => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timeout);
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
          callback();
        };
        const onSeeked = () => finish(resolveSeek);
        const onError = () => finish(() => rejectSeek(new Error("Failed while seeking video")));
        const timeout = window.setTimeout(() => finish(resolveSeek), 5000);
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.currentTime = time;
      });

    video.onloadedmetadata = () => {
      void (async () => {
        try {
          const duration = video.duration;
          if (!Number.isFinite(duration) || duration <= 0 || video.videoWidth <= 0 || video.videoHeight <= 0) {
            throw new Error("This video has no readable frames");
          }

          const step = 1 / Math.max(1, fps);
          const count = Math.min(maxFrames, Math.max(1, Math.ceil(duration * fps)));
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Your browser cannot create a video canvas");

          const results: { dataUrl: string; timestamp: number; width: number; height: number }[] = [];
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          for (let i = 0; i < count; i++) {
            const timestamp = Math.min(i * step, Math.max(0, duration - 0.001));
            await seekTo(timestamp);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            results.push({
              dataUrl: canvas.toDataURL("image/jpeg", 0.85),
              timestamp,
              width: canvas.width,
              height: canvas.height,
            });
            onProgress(Math.round(((i + 1) / count) * 100));
          }

          if (settled) return;
          settled = true;
          cleanup();
          resolve(results);
        } catch (error) {
          fail(error);
        }
      })();
    };

    video.onerror = () => fail(new Error("Failed to load video. Try an MP4 or WebM file."));
    video.src = url;
    video.load();
  });
}

function computeSimilarityTransform(
  srcEyeL: { x: number; y: number },
  srcEyeR: { x: number; y: number },
  dstEyeL: { x: number; y: number },
  dstEyeR: { x: number; y: number }
) {
  const srcLen = dist(srcEyeL, srcEyeR) || 1;
  const dstLen = dist(dstEyeL, dstEyeR) || 1;
  const scale = dstLen / srcLen;

  const srcAngle = Math.atan2(srcEyeR.y - srcEyeL.y, srcEyeR.x - srcEyeL.x);
  const dstAngle = Math.atan2(dstEyeR.y - dstEyeL.y, dstEyeR.x - dstEyeL.x);
  const rotation = dstAngle - srcAngle;

  const scx = (srcEyeL.x + srcEyeR.x) / 2;
  const scy = (srcEyeL.y + srcEyeR.y) / 2;
  const dcx = (dstEyeL.x + dstEyeR.x) / 2;
  const dcy = (dstEyeL.y + dstEyeR.y) / 2;

  const cos = Math.cos(rotation) * scale;
  const sin = Math.sin(rotation) * scale;
  const tx = dcx - cos * scx + sin * scy;
  const ty = dcy - sin * scx - cos * scy;

  return { a: cos, b: sin, c: -sin, d: cos, e: tx, f: ty };
}

async function restoreFaceCanvas(
  originalDataUrl: string,
  refDataUrl: string,
  ref: NonNullable<ReturnType<typeof computeKeyPoints>>,
  tgt: NonNullable<ReturnType<typeof computeKeyPoints>>,
  width: number,
  height: number,
  strength: number
): Promise<string> {
  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const [origImg, refImg] = await Promise.all([
    loadImage(originalDataUrl),
    loadImage(refDataUrl),
  ]);

  const warpCanvas = document.createElement("canvas");
  warpCanvas.width = width;
  warpCanvas.height = height;
  const warpCtx = warpCanvas.getContext("2d")!;

  const m = computeSimilarityTransform(
    ref.eyeLeft,
    ref.eyeRight,
    tgt.eyeLeft,
    tgt.eyeRight
  );

  warpCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  warpCtx.drawImage(refImg, 0, 0, width, height);
  warpCtx.resetTransform();

  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const ctx = output.getContext("2d")!;

  ctx.drawImage(origImg, 0, 0);

  const fb = tgt.faceBounds;
  const cx = fb.x + fb.w / 2;
  const cy = fb.y + fb.h * 0.45;
  const rx = fb.w * 0.56;
  const ry = fb.h * 0.62;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = strength;
  ctx.drawImage(warpCanvas, 0, 0);
  ctx.restore();

  return output.toDataURL("image/png");
}

export function useFaceSync() {
  const [state, setState] = useState<FaceSyncState>({
    phase: "idle",
    progress: 0,
    frames: [],
    referenceIdx: 0,
    error: null,
    totalFrames: 0,
  });

  const detectorRef = useRef<unknown>(null);
  const operationRef = useRef(0);

  const setPhase = useCallback(
    (phase: FaceSyncPhase, progress = 0, extra: Partial<FaceSyncState> = {}) => {
      setState((s) => ({ ...s, phase, progress, error: null, ...extra }));
    },
    []
  );

  const analyzeVideo = useCallback(
    async (file: File, analysisFps = 2, maxFrames = 120) => {
      const operation = ++operationRef.current;
      const isCurrent = () => operationRef.current === operation;
      setPhase("extracting", 0);

      try {
        const rawFrames = await extractFramesFromVideo(
          file,
          analysisFps,
          maxFrames,
          (pct) => {
            if (isCurrent()) {
              setState((s) => ({ ...s, progress: Math.round(pct * 0.4) }));
            }
          }
        );
        if (!isCurrent()) return;

        setPhase("analyzing", 40, { totalFrames: rawFrames.length });

        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );

        if (!detectorRef.current) {
          const filesetResolver = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
          const options = {
            baseOptions: {
              modelAssetPath: FACE_LANDMARKER_MODEL,
              delegate: "GPU" as const,
            },
            outputFaceBlendshapes: false,
            runningMode: "IMAGE" as const,
            numFaces: 1,
          };

          try {
            detectorRef.current = await FaceLandmarker.createFromOptions(filesetResolver, options);
          } catch {
            // Some browsers cannot initialize the GPU delegate. CPU keeps the
            // feature usable instead of failing before the first frame.
            detectorRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
              ...options,
              baseOptions: { ...options.baseOptions, delegate: "CPU" as const },
            });
          }
        }

        const detector = detectorRef.current as {
          detect: (img: HTMLImageElement) => {
            faceLandmarks: NormalizedLandmark[][];
          };
        };

        const analyzed: FrameFaceData[] = [];

        for (let i = 0; i < rawFrames.length; i++) {
          if (!isCurrent()) return;
          const f = rawFrames[i];
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = f.dataUrl;
          });

          let landmarks: NormalizedLandmark[] | null = null;
          let keyPts = null;

          try {
            const result = detector.detect(img);
            if (result.faceLandmarks.length > 0) {
              landmarks = result.faceLandmarks[0] as NormalizedLandmark[];
              keyPts = computeKeyPoints(landmarks, f.width, f.height);
            }
          } catch {
            // no face
          }

          analyzed.push({
            frameIndex: i,
            timestamp: f.timestamp,
            dataUrl: f.dataUrl,
            width: f.width,
            height: f.height,
            landmarks,
            driftScore: 0,
            eyeLeft: keyPts?.eyeLeft ?? null,
            eyeRight: keyPts?.eyeRight ?? null,
            noseTip: keyPts?.noseTip ?? null,
            faceBounds: keyPts?.faceBounds ?? null,
            restored: false,
            restoredDataUrl: null,
          });

          if (isCurrent()) {
            setState((s) => ({
              ...s,
              progress: 40 + Math.round(((i + 1) / rawFrames.length) * 50),
              frames: [...analyzed],
            }));
          }
        }
        if (!isCurrent()) return;

        const bestRef = analyzed.reduce<number>((best, f, idx) => {
          if (!f.landmarks) return best;
          return best === -1 ? idx : idx < analyzed.length * 0.25 ? idx : best;
        }, -1);
        const refIdx = bestRef === -1 ? 0 : bestRef;
        const refLandmarks = analyzed[refIdx]?.landmarks;

        const withDrift = analyzed.map((f) => {
          if (!f.landmarks || !refLandmarks || f.frameIndex === refIdx) {
            return { ...f, driftScore: 0 };
          }
          return { ...f, driftScore: computeDrift(refLandmarks, f.landmarks) };
        });

        setState((s) => ({
          ...s,
          phase: "done",
          progress: 100,
          frames: withDrift,
          referenceIdx: refIdx,
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: e instanceof Error ? e.message : "Analysis failed",
        }));
      }
    },
    [setPhase]
  );

  const setReferenceFrame = useCallback((idx: number) => {
    setState((s) => {
      const refLandmarks = s.frames[idx]?.landmarks;
      if (!refLandmarks) return s;
      const withDrift = s.frames.map((f) => {
        if (!f.landmarks || f.frameIndex === idx) return { ...f, driftScore: 0 };
        return { ...f, driftScore: computeDrift(refLandmarks, f.landmarks) };
      });
      return { ...s, referenceIdx: idx, frames: withDrift };
    });
  }, []);

  const restoreFrames = useCallback(
    async (threshold: number, strength: number) => {
      const operation = ++operationRef.current;
      const isCurrent = () => operationRef.current === operation;
      const ref = state.frames[state.referenceIdx];
      if (!ref?.landmarks) {
        setState((s) => ({ ...s, phase: "done", progress: 100 }));
        return;
      }

      const toRestore = state.frames.filter(
        (f) => f.driftScore >= threshold && f.landmarks && f.faceBounds && !f.restored
      );
      if (!toRestore.length) {
        setState((s) => ({ ...s, phase: "done", progress: 100 }));
        return;
      }

      const refKeyPts = computeKeyPoints(ref.landmarks, ref.width, ref.height);
      if (!refKeyPts) {
        setState((s) => ({ ...s, phase: "done", progress: 100 }));
        return;
      }

      setState((s) => ({ ...s, phase: "restoring", progress: 0, error: null }));

      try {
        let done = 0;
        const results = await Promise.all(
          toRestore.map(async (f) => {
            const tgtKeyPts = computeKeyPoints(f.landmarks!, f.width, f.height);
            if (!tgtKeyPts) return { idx: f.frameIndex, dataUrl: null };

            const restored = await restoreFaceCanvas(
              f.dataUrl,
              ref.dataUrl,
              refKeyPts,
              tgtKeyPts,
              f.width,
              f.height,
              strength
            );
            if (!isCurrent()) return { idx: f.frameIndex, dataUrl: null };
            done++;
            setState((prev) => ({
              ...prev,
              progress: Math.round((done / toRestore.length) * 100),
            }));
            return { idx: f.frameIndex, dataUrl: restored };
          })
        );

        if (!isCurrent()) return;
        setState((prev) => ({
          ...prev,
          phase: "done",
          progress: 100,
          frames: prev.frames.map((f) => {
            const result = results.find((item) => item.idx === f.frameIndex);
            return result?.dataUrl
              ? { ...f, restored: true, restoredDataUrl: result.dataUrl }
              : f;
          }),
        }));
      } catch (error) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: error instanceof Error ? error.message : "Face restoration failed",
        }));
      }
    },
    [state]
  );

  const clearRestoration = useCallback((frameIdx: number) => {
    setState((s) => ({
      ...s,
      frames: s.frames.map((f) =>
        f.frameIndex === frameIdx
          ? { ...f, restored: false, restoredDataUrl: null }
          : f
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    operationRef.current++;
    setState({
      phase: "idle",
      progress: 0,
      frames: [],
      referenceIdx: 0,
      error: null,
      totalFrames: 0,
    });
    detectorRef.current = null;
  }, []);

  return {
    state,
    analyzeVideo,
    setReferenceFrame,
    restoreFrames,
    clearRestoration,
    reset,
  };
}
