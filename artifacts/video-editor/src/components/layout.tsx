import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MonitorPlay, Settings, Home, HardDrive } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const isProject = location.startsWith("/projects/");
  const projectId = isProject ? location.split("/")[2] : null;

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground dark">
      <header className="h-14 border-b border-border flex items-center px-4 shrink-0 bg-sidebar/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mr-6 text-primary">
          <MonitorPlay className="w-5 h-5" />
          <span className="font-bold tracking-tight uppercase">FrameForge</span>
        </div>
        
        <nav className="flex items-center gap-1 flex-1">
          <Button
            variant={location === "/" ? "secondary" : "ghost"}
            size="sm"
            asChild
            className={cn("h-8 px-3 text-xs", location === "/" && "bg-secondary text-secondary-foreground")}
          >
            <Link href="/">
              <Home className="w-3.5 h-3.5 mr-2" />
              Dashboard
            </Link>
          </Button>

          {isProject && projectId && (
            <>
              <div className="w-px h-4 bg-border mx-2" />
              <Button
                variant={location === `/projects/${projectId}` ? "secondary" : "ghost"}
                size="sm"
                asChild
                className={cn("h-8 px-3 text-xs", location === `/projects/${projectId}` && "bg-secondary text-secondary-foreground")}
              >
                <Link href={`/projects/${projectId}`}>
                  <HardDrive className="w-3.5 h-3.5 mr-2" />
                  Workspace
                </Link>
              </Button>
              <Button
                variant={location === `/projects/${projectId}/settings` ? "secondary" : "ghost"}
                size="sm"
                asChild
                className={cn("h-8 px-3 text-xs", location === `/projects/${projectId}/settings` && "bg-secondary text-secondary-foreground")}
              >
                <Link href={`/projects/${projectId}/settings`}>
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  Settings
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}