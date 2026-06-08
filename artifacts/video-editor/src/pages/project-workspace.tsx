import { Layout } from "@/components/layout";
import { useGetProject, useListSources, useUpdateProject } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, SplitSquareHorizontal, ScanFace, Upload } from "lucide-react";
import { FrameEditor } from "@/components/video-editor/frame-editor";
import { MultiCompare } from "@/components/video-editor/multi-compare";
import { BlurStudio } from "@/components/video-editor/blur-studio";
import { ExportsPanel } from "@/components/video-editor/exports";

export function ProjectWorkspace() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  
  const { data: project, isLoading: projectLoading } = useGetProject(projectId, { 
    query: { enabled: !!projectId } 
  });
  
  const { data: sources, isLoading: sourcesLoading } = useListSources(projectId, {
    query: { enabled: !!projectId }
  });

  if (projectLoading || sourcesLoading) {
    return (
      <Layout>
        <div className="w-full h-full flex flex-col p-4 space-y-4">
          <Skeleton className="h-10 w-64 bg-card" />
          <Skeleton className="flex-1 w-full bg-card" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">Project not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Tabs defaultValue="frame-editor" className="flex-1 flex flex-col w-full h-full overflow-hidden bg-background">
        <div className="border-b border-border bg-sidebar/30 shrink-0 px-4 pt-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-medium tracking-tight flex items-center gap-2">
                <span className="text-muted-foreground">Project /</span> {project.name}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              {sources?.length || 0} Sources | {project.status}
            </div>
          </div>
          
          <TabsList className="bg-transparent p-0 h-9 justify-start border-none">
            <TabsTrigger 
              value="frame-editor" 
              className="data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:border-x data-[state=active]:border-t rounded-none rounded-t-md px-4 py-2 border border-transparent border-b-0 h-9 font-mono text-xs tracking-wide"
            >
              <Film className="w-3.5 h-3.5 mr-2" />
              Frame Editor
            </TabsTrigger>
            <TabsTrigger 
              value="multi-compare" 
              className="data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:border-x data-[state=active]:border-t rounded-none rounded-t-md px-4 py-2 border border-transparent border-b-0 h-9 font-mono text-xs tracking-wide"
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5 mr-2" />
              Multi-Compare
            </TabsTrigger>
            <TabsTrigger 
              value="blur-studio" 
              className="data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:border-x data-[state=active]:border-t rounded-none rounded-t-md px-4 py-2 border border-transparent border-b-0 h-9 font-mono text-xs tracking-wide"
            >
              <ScanFace className="w-3.5 h-3.5 mr-2" />
              Blur Studio
            </TabsTrigger>
            <TabsTrigger 
              value="exports" 
              className="data-[state=active]:bg-card data-[state=active]:border-border data-[state=active]:border-x data-[state=active]:border-t rounded-none rounded-t-md px-4 py-2 border border-transparent border-b-0 h-9 font-mono text-xs tracking-wide"
            >
              <Upload className="w-3.5 h-3.5 mr-2" />
              Exports
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 relative overflow-hidden bg-card/30">
          <TabsContent value="frame-editor" className="absolute inset-0 m-0 border-0 p-0 h-full w-full">
            <FrameEditor project={project} sources={sources || []} />
          </TabsContent>
          <TabsContent value="multi-compare" className="absolute inset-0 m-0 border-0 p-0 h-full w-full">
            <MultiCompare project={project} sources={sources || []} />
          </TabsContent>
          <TabsContent value="blur-studio" className="absolute inset-0 m-0 border-0 p-0 h-full w-full">
            <BlurStudio project={project} sources={sources || []} />
          </TabsContent>
          <TabsContent value="exports" className="absolute inset-0 m-0 border-0 p-0 h-full w-full">
            <ExportsPanel project={project} />
          </TabsContent>
        </div>
      </Tabs>
    </Layout>
  );
}