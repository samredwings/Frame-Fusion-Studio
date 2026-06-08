import { VideoSource, Project } from "@workspace/api-client-react";
import { SplitSquareHorizontal, Layers, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MultiCompareProps {
  project: Project;
  sources: VideoSource[];
}

export function MultiCompare({ project, sources }: MultiCompareProps) {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
            <Layers className="w-3.5 h-3.5 mr-2" />
            Add Compare Track
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90">
            <Play className="w-3.5 h-3.5 mr-2" />
            Sync Play
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Placeholder for dual/quad view */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="bg-black border border-border rounded-lg flex items-center justify-center relative shadow-md">
            <span className="absolute top-4 left-4 bg-background/80 px-2 py-1 rounded font-mono text-[10px] text-muted-foreground uppercase tracking-widest border border-border/50">Track A</span>
            <div className="text-muted-foreground/30 font-mono">Empty Track</div>
          </div>
          <div className="bg-black border border-border rounded-lg flex items-center justify-center relative shadow-md">
            <span className="absolute top-4 left-4 bg-background/80 px-2 py-1 rounded font-mono text-[10px] text-muted-foreground uppercase tracking-widest border border-border/50">Track B</span>
            <div className="text-muted-foreground/30 font-mono">Empty Track</div>
          </div>
        </div>
        
        {/* Timeline placeholder */}
        <div className="h-24 bg-card border border-border rounded-lg p-4 flex flex-col">
          <div className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">Comparison Timeline</div>
          <div className="flex-1 bg-background rounded border border-border/50 flex items-center px-4 relative overflow-hidden">
             <div className="absolute left-1/4 top-0 bottom-0 w-px bg-primary z-10 shadow-[0_0_8px_rgba(255,100,0,0.8)]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}