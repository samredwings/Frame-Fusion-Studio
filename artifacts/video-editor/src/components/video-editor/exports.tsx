import { Project } from "@workspace/api-client-react";
import { Upload, Settings2, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ExportsPanelProps {
  project: Project;
}

export function ExportsPanel({ project }: ExportsPanelProps) {
  return (
    <div className="h-full w-full p-8 overflow-y-auto bg-background/50">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-mono uppercase mb-1">Final Export</h2>
          <p className="text-muted-foreground text-sm">Compile your edits, blurs, and comparisons into a final video.</p>
        </div>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Export Settings</CardTitle>
            <CardDescription>Configure output format and quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase">Format</label>
                <div className="h-10 bg-background border border-border rounded flex items-center px-3 text-sm">MP4 (H.264)</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase">Resolution</label>
                <div className="h-10 bg-background border border-border rounded flex items-center px-3 text-sm">Match Source (1080p)</div>
              </div>
            </div>
            
            <div className="bg-secondary/30 border border-border/50 rounded-lg p-4 mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Estimated Output</span>
                <span className="text-xs font-mono text-muted-foreground">~45 MB</span>
              </div>
              <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border/50">
                <div className="h-full bg-primary w-1/3"></div>
              </div>
            </div>

            <Button className="w-full mt-4 font-mono uppercase tracking-wider" size="lg">
              <FileVideo className="w-4 h-4 mr-2" />
              Render Final Video
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}