import { VideoSource, Project } from "@workspace/api-client-react";
import { ScanFace, User, Focus, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlurStudioProps {
  project: Project;
  sources: VideoSource[];
}

export function BlurStudio({ project, sources }: BlurStudioProps) {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
            <ScanFace className="w-3.5 h-3.5 mr-2" />
            Auto-Detect Faces
          </Button>
          <div className="w-px h-4 bg-border mx-2" />
          <Button variant="ghost" size="sm" className="h-8 text-xs font-mono">
            <MousePointer2 className="w-3.5 h-3.5 mr-2" />
            Draw Region
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r border-border bg-sidebar/50 p-4 shrink-0 flex flex-col gap-4 overflow-y-auto">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">Blur Regions</h3>
          <div className="text-center p-4 border border-dashed border-border/50 rounded-md text-muted-foreground text-xs">
            No regions created
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-background/50 relative p-8">
          <div className="w-full max-w-4xl mx-auto aspect-video bg-black rounded-lg border border-border flex items-center justify-center shadow-2xl relative overflow-hidden">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Focus className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-mono text-sm">Select a frame to add blur regions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}