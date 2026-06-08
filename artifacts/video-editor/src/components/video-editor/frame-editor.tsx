import { VideoSource, Project } from "@workspace/api-client-react";
import { Film, UploadCloud, Images, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FrameEditorProps {
  project: Project;
  sources: VideoSource[];
}

export function FrameEditor({ project, sources }: FrameEditorProps) {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-border bg-background flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
            <UploadCloud className="w-3.5 h-3.5 mr-2" />
            Import Video
          </Button>
          <div className="w-px h-4 bg-border mx-2" />
          <Button variant="ghost" size="sm" className="h-8 text-xs font-mono" disabled>
            <Images className="w-3.5 h-3.5 mr-2" />
            Extract Frames (WASM)
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Sources List */}
        <div className="w-64 border-r border-border bg-sidebar/50 p-4 shrink-0 flex flex-col gap-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">Sources</h3>
          
          {sources.length === 0 ? (
            <div className="text-center p-4 border border-dashed border-border/50 rounded-md text-muted-foreground text-xs">
              No sources imported
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map(source => (
                <div key={source.id} className="p-2 bg-card rounded border border-border flex items-center gap-2 text-xs">
                  <Film className="w-4 h-4 text-primary" />
                  <span className="truncate flex-1">{source.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center: Viewer/Editor */}
        <div className="flex-1 flex flex-col bg-background/50 relative">
          <div className="flex-1 p-8 flex items-center justify-center">
            <div className="w-full max-w-3xl aspect-video bg-black rounded-lg border border-border flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <HardDrive className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-mono text-sm">Select a source to view frames</p>
              </div>
            </div>
          </div>
          
          {/* Bottom: Filmstrip */}
          <div className="h-32 border-t border-border bg-card/80 shrink-0 p-2 overflow-x-auto flex items-center gap-2">
            <div className="text-xs text-muted-foreground font-mono px-4">
              Frame Strip
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}