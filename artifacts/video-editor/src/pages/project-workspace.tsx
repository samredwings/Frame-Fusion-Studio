import { useMemo } from "react";
import { useGetProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, SplitSquareHorizontal, ScanFace, Upload, Crosshair, Settings2, AlertTriangle, RotateCw, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrameEditor } from "@/components/video-editor/frame-editor";
import { MultiCompare } from "@/components/video-editor/multi-compare";
import { BlurStudio } from "@/components/video-editor/blur-studio";
import { ExportsPanel } from "@/components/video-editor/exports";
import { FaceSyncStudio } from "@/components/video-editor/face-sync";
import { ProjectMediaProvider, useProjectMedia } from "@/hooks/use-project-media";
import { Layout } from "@/components/layout";

const tools = [
  { id: "frame-editor", label: "Frame Editor", icon: Film },
  { id: "multi-compare", label: "Multi-Compare", icon: SplitSquareHorizontal },
  { id: "blur-studio", label: "Blur Studio", icon: ScanFace },
  { id: "face-sync", label: "FaceSync", icon: Crosshair },
  { id: "exports", label: "Exports", icon: Upload },
] as const;
type ToolId = typeof tools[number]["id"];

export function ProjectWorkspace() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const projectQuery = useGetProject(projectId, { query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } });
  if (projectQuery.isLoading) return <Layout><div className="p-4 space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-[60vh] w-full" /></div></Layout>;
  if (projectQuery.isError || !projectQuery.data) return <Layout><div className="m-auto max-w-md p-6 text-center"><AlertTriangle className="mx-auto mb-3 text-primary" /><h1 className="text-xl font-semibold">Project unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This workspace could not be loaded. Return to the dashboard and try again.</p><Button asChild className="mt-5"><Link href="/">Go to dashboard</Link></Button></div></Layout>;
  return <ProjectMediaProvider projectId={projectId}><WorkspaceContent project={projectQuery.data} /></ProjectMediaProvider>;
}

function WorkspaceContent({ project }: { project: NonNullable<ReturnType<typeof useGetProject>["data"]> }) {
  const [location, setLocation] = useLocation();
  const media = useProjectMedia();
  const query = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);
  const requestedTool = query.get("tool") as ToolId | null;
  const activeTool: ToolId = tools.some((tool) => tool.id === requestedTool) ? requestedTool! : "frame-editor";
  const updateTool = (tool: string) => {
    const next = new URLSearchParams(location.split("?")[1] ?? "");
    next.set("tool", tool);
    if (media.selectedSourceId) next.set("source", String(media.selectedSourceId));
    setLocation(`${location.split("?")[0]}?${next.toString()}`);
  };
  const needsFile = !!media.selectedSource && (!media.selectedSource.objectPath || (!!media.selectedSource.objectPath && !media.sourceFile && !media.loadingSource && !media.uploadError));
  return (
    <Layout>
      <div className="editor-shell flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border bg-sidebar/55 px-3 pt-2 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>WORKSPACE</span><span aria-hidden="true">/</span><span className="truncate text-foreground" data-testid="text-project-name">{project.name}</span></div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-chart-3" /> {media.sources.length} source{media.sources.length === 1 ? "" : "s"} <span className="opacity-40">·</span> {project.status}</div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <label className="sr-only" htmlFor="workspace-source">Selected source</label>
              <select id="workspace-source" data-testid="select-workspace-source" aria-label="Selected source" className="h-11 max-w-[52vw] rounded-md border border-border bg-card px-3 text-sm sm:max-w-72" value={media.selectedSourceId ?? ""} onChange={(event) => event.target.value && media.selectSource(Number(event.target.value))}>
                {!media.sources.length && <option value="">No source selected</option>}
                {media.sources.map((source) => <option key={source.id} value={source.id}>{source.filename}{!source.objectPath ? " — re-upload needed" : ""}</option>)}
              </select>
              <input id="workspace-media-input" data-testid="input-source-upload" className="sr-only" type="file" accept="video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void media.importSource(file, needsFile ? media.selectedSource?.id : undefined).catch(() => undefined); event.currentTarget.value = ""; }} />
              <Button type="button" variant={needsFile ? "default" : "outline"} className="h-11 shrink-0 px-3" onClick={() => document.getElementById("workspace-media-input")?.click()} data-testid="button-import-source"><Upload className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">{needsFile ? "Re-upload" : "Import video"}</span><span className="sm:hidden">{needsFile ? "Replace" : "Import"}</span></Button>
              <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Project settings" data-testid="link-project-settings"><Link href={`/projects/${project.id}/settings`}><Settings2 className="h-4 w-4" /></Link></Button>
            </div>
          </div>
          {media.uploadProgress > 0 && <div className="h-0.5 overflow-hidden bg-muted"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${media.uploadProgress}%` }} /></div>}
          {media.uploadError && <div role="alert" className="mb-2 flex items-center justify-between gap-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="status-source-upload-error"><span>{media.uploadError}</span><Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => document.getElementById("workspace-media-input")?.click()}>Try again</Button></div>}
          <div className="editor-tool-tabs hidden items-center gap-1 sm:flex" role="tablist" aria-label="Project tools">
            {tools.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={activeTool === id} onClick={() => updateTool(id)} data-testid={`tab-tool-${id}`} className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-xs transition-colors ${activeTool === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}
          </div>
          <div className="pb-2 sm:hidden"><label className="sr-only" htmlFor="workspace-tool">Active tool</label><select id="workspace-tool" data-testid="select-workspace-tool" className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm" value={activeTool} onChange={(event) => updateTool(event.target.value)}>{tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.label}</option>)}</select></div>
        </div>
        {media.sources.length > 0 && media.selectedSource?.objectPath && media.loadingSource && <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground" data-testid="status-source-loading"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" /> Loading selected video…</div>}
        {media.selectedSource && needsFile && <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-lg border border-chart-4/35 bg-chart-4/5 px-3 py-3 text-sm" data-testid="status-source-unavailable"><div className="flex min-w-0 items-center gap-2"><FolderOpen className="h-4 w-4 shrink-0 text-chart-4" /><span><strong className="font-medium">{media.selectedSource.filename}</strong> needs its original video attached before editing.</span></div><Button className="min-h-11 shrink-0" size="sm" onClick={() => document.getElementById("workspace-media-input")?.click()}><RotateCw className="mr-2 h-4 w-4" />Re-upload</Button></div>}
        <Tabs value={activeTool} onValueChange={updateTool} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="sr-only"><TabsTrigger value="frame-editor">Frame Editor</TabsTrigger><TabsTrigger value="multi-compare">Multi-Compare</TabsTrigger><TabsTrigger value="blur-studio">Blur Studio</TabsTrigger><TabsTrigger value="face-sync">FaceSync</TabsTrigger><TabsTrigger value="exports">Exports</TabsTrigger></TabsList>
          <section className="relative min-h-0 flex-1 overflow-hidden bg-background" aria-label={`${tools.find((tool) => tool.id === activeTool)?.label} workspace`}>
            <TabsContent value="frame-editor" className="absolute inset-0 m-0 h-full w-full overflow-auto"><FrameEditor project={project} sources={media.sources} /></TabsContent>
            <TabsContent value="multi-compare" className="absolute inset-0 m-0 h-full w-full overflow-auto"><MultiCompare project={project} sources={media.sources} /></TabsContent>
            <TabsContent value="blur-studio" className="absolute inset-0 m-0 h-full w-full overflow-auto"><BlurStudio project={project} sources={media.sources} /></TabsContent>
            <TabsContent value="face-sync" className="absolute inset-0 m-0 h-full w-full overflow-auto"><FaceSyncStudio project={project} /></TabsContent>
            <TabsContent value="exports" className="absolute inset-0 m-0 h-full w-full overflow-auto"><ExportsPanel project={project} /></TabsContent>
          </section>
        </Tabs>
      </div>
    </Layout>
  );
}