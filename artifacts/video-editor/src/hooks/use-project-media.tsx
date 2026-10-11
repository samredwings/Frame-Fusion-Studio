import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getGetStorageObjectQueryKey,
  getListSourcesQueryKey,
  useAddSource,
  useGetStorageObject,
  useListSources,
  useRequestUploadUrl,
  useUpdateSource,
  type VideoSource,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useVideoMeta } from "@/hooks/use-video-meta";

type MediaContextValue = {
  sources: VideoSource[];
  selectedSource: VideoSource | null;
  selectedSourceId: number | null;
  sourceFile: File | null;
  sourceUrl: string | null;
  loadingSource: boolean;
  uploadProgress: number;
  uploadError: string | null;
  selectSource: (id: number) => void;
  importSource: (file: File, attachToId?: number, role?: VideoSource["role"]) => Promise<void>;
  retrySource: () => void;
};
const MediaContext = createContext<MediaContextValue | null>(null);

export function ProjectMediaProvider({ projectId, children }: { projectId: number; children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { analyzeFile } = useVideoMeta();
  const { data: sources = [] } = useListSources(projectId, {
    query: { enabled: !!projectId, queryKey: getListSourcesQueryKey(projectId) },
  });
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const requestedId = Number(params.get("source"));
  const selectedSource = sources.find((source) => source.id === requestedId)
    ?? sources.find((source) => source.role === "primary")
    ?? sources[0]
    ?? null;
  const objectPath = selectedSource?.objectPath ?? "";
  const storageQuery = useGetStorageObject(objectPath, {
    query: { enabled: !!objectPath, queryKey: getGetStorageObjectQueryKey(objectPath), retry: 1 },
  });
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const requestUrl = useRequestUploadUrl();
  const addSource = useAddSource();
  const updateSource = useUpdateSource();

  useEffect(() => {
    let stale = false;
    if (!selectedSource?.objectPath || !storageQuery.data) {
      setSourceFile(null);
      setSourceUrl(null);
      return;
    }
    const blob = storageQuery.data;
    const file = new File([blob], selectedSource.filename, { type: blob.type || "video/mp4" });
    const url = URL.createObjectURL(blob);
    setSourceFile(file);
    setSourceUrl(url);
    return () => {
      stale = true;
      URL.revokeObjectURL(url);
      if (stale) {
        setSourceFile((current) => current === file ? null : current);
        setSourceUrl((current) => current === url ? null : current);
      }
    };
  }, [selectedSource?.id, selectedSource?.objectPath, selectedSource?.filename, storageQuery.data]);

  const selectSource = useCallback((id: number) => {
    const next = new URLSearchParams(location.split("?")[1] ?? "");
    next.set("source", String(id));
    const query = next.toString();
    setLocation(`${location.split("?")[0]}${query ? `?${query}` : ""}`);
  }, [location, setLocation]);

  const importSource = useCallback(async (file: File, attachToId?: number, role?: VideoSource["role"]) => {
    if (!file.type.startsWith("video/")) {
      setUploadError("Choose a video file to continue.");
      return;
    }
    setUploadError(null);
    setUploadProgress(8);
    try {
      const meta = await analyzeFile(file);
      setUploadProgress(28);
      const signed = await requestUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || "video/mp4" } });
      if (!signed?.uploadURL || !signed.objectPath) throw new Error("The upload service returned an incomplete URL.");
      setUploadProgress(42);
      const response = await fetch(signed.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "video/mp4" } });
      if (!response.ok) throw new Error(`Storage upload failed (${response.status}). Retry the upload.`);
      setUploadProgress(78);
      const metadata = {
        objectPath: signed.objectPath,
        fps: meta.fps,
        totalFrames: meta.frameCount,
        durationMs: Math.round(meta.duration * 1000),
        width: meta.width,
        height: meta.height,
        fileSize: file.size,
      };
      let saved: VideoSource;
      if (attachToId) {
        saved = await updateSource.mutateAsync({ id: projectId, sourceId: attachToId, data: metadata });
      } else {
        saved = await addSource.mutateAsync({
          id: projectId,
          data: { filename: file.name, ...metadata, role: role ?? (sources.length ? "comparison" : "primary") },
        });
      }
      await queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey(projectId) });
      await queryClient.invalidateQueries({ queryKey: getGetStorageObjectQueryKey(signed.objectPath) });
      setUploadProgress(100);
      const next = new URLSearchParams(location.split("?")[1] ?? "");
      next.set("source", String(saved.id));
      setLocation(`${location.split("?")[0]}?${next.toString()}`);
      window.setTimeout(() => setUploadProgress(0), 900);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Try again.");
      setUploadProgress(0);
      throw error;
    }
  }, [addSource, analyzeFile, location, projectId, queryClient, requestUrl, setLocation, sources.length, updateSource]);

  const retrySource = useCallback(() => {
    if (objectPath) void queryClient.invalidateQueries({ queryKey: getGetStorageObjectQueryKey(objectPath) });
  }, [objectPath, queryClient]);

  const value = useMemo<MediaContextValue>(() => ({
    sources, selectedSource, selectedSourceId: selectedSource?.id ?? null,
    sourceFile, sourceUrl, loadingSource: !!selectedSource?.objectPath && storageQuery.isLoading,
    uploadProgress, uploadError, selectSource, importSource, retrySource,
  }), [sources, selectedSource, sourceFile, sourceUrl, storageQuery.isLoading, uploadProgress, uploadError, selectSource, importSource, retrySource]);
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useProjectMedia() {
  const value = useContext(MediaContext);
  if (!value) throw new Error("useProjectMedia must be used within ProjectMediaProvider");
  return value;
}
