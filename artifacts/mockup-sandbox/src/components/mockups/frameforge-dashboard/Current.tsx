import "./_group.css";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  EyeOff,
  FolderOpen,
  Home,
  Layers,
  MonitorPlay,
  Plus,
  Scissors,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type Project = {
  id: number;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  fps: number | null;
  stats: {
    sourceCount: number;
    frameEditCount: number;
    blurRegionCount: number;
    maskedRegionCount: number;
  };
};

const initialProjects: Project[] = [
  {
    id: 1,
    name: "AI Walk Cycle Merge",
    description:
      "Merging 3 walk cycle generations — same start pose, different movement flows",
    status: "active",
    fps: 24,
    createdAt: "2026-06-08T10:23:44.413Z",
    stats: {
      sourceCount: 3,
      frameEditCount: 0,
      blurRegionCount: 0,
      maskedRegionCount: 0,
    },
  },
  {
    id: 2,
    name: "Interview Blur Demo",
    description: "Face blur tracking test on interview footage",
    status: "draft",
    fps: 30,
    createdAt: "2026-06-08T10:23:44.413Z",
    stats: {
      sourceCount: 1,
      frameEditCount: 0,
      blurRegionCount: 2,
      maskedRegionCount: 2,
    },
  },
  {
    id: 3,
    name: "rdrtdg",
    description: "",
    status: "draft",
    fps: null,
    createdAt: "2026-10-09T05:27:04.675Z",
    stats: {
      sourceCount: 1,
      frameEditCount: 0,
      blurRegionCount: 0,
      maskedRegionCount: 0,
    },
  },
];

function ProjectCard({ project }: { project: Project }) {
  return (
    <a
      href={`#project-${project.id}`}
      onClick={(event) => event.preventDefault()}
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Open ${project.name}`}
    >
      <Card className="group cursor-pointer border-border/50 bg-card/50 transition-colors hover:border-primary/50 hover-elevate">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="truncate text-base transition-colors group-hover:text-primary">
                {project.name}
              </CardTitle>
              <CardDescription className="line-clamp-1 text-xs">
                {project.description || "No description"}
              </CardDescription>
            </div>
            <span className="shrink-0 rounded bg-secondary/50 px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {project.status}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 rounded bg-background/50 p-2">
              <Video className="h-3.5 w-3.5 text-primary/70" />
              <span>{project.stats.sourceCount} Sources</span>
            </div>
            <div className="flex items-center gap-1.5 rounded bg-background/50 p-2">
              <Scissors className="h-3.5 w-3.5 text-chart-2/70" />
              <span>{project.stats.frameEditCount} Edits</span>
            </div>
            <div className="flex items-center gap-1.5 rounded bg-background/50 p-2">
              <Layers className="h-3.5 w-3.5 text-chart-3/70" />
              <span>{project.stats.blurRegionCount} Regions</span>
            </div>
            <div className="flex items-center gap-1.5 rounded bg-background/50 p-2">
              <EyeOff className="h-3.5 w-3.5 text-chart-4/70" />
              <span>{project.stats.maskedRegionCount} Masked</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between pt-0 text-[10px] text-muted-foreground">
          <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
          <span>{project.fps || 30} FPS</span>
        </CardFooter>
      </Card>
    </a>
  );
}

export function Current() {
  const [projects, setProjects] = useState(initialProjects);
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "" },
  });

  function onSubmit(values: z.infer<typeof createProjectSchema>) {
    setProjects((current) => [
      {
        id: Date.now(),
        name: values.name,
        description: values.description ?? "",
        status: "draft",
        createdAt: new Date().toISOString(),
        fps: 30,
        stats: {
          sourceCount: 0,
          frameEditCount: 0,
          blurRegionCount: 0,
          maskedRegionCount: 0,
        },
      },
      ...current,
    ]);
    form.reset();
    setOpen(false);
  }

  return (
    <div className="dark flex min-h-screen w-full flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-sidebar/50 px-4 backdrop-blur-sm">
        <div className="mr-6 flex items-center gap-2 text-primary">
          <MonitorPlay className="h-5 w-5" />
          <span className="font-bold tracking-tight uppercase">FrameForge</span>
        </div>
        <nav className="flex flex-1 items-center gap-1" aria-label="Main navigation">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 bg-secondary px-3 text-xs text-secondary-foreground"
            aria-current="page"
          >
            <Home className="mr-2 h-3.5 w-3.5" />
            Dashboard
          </Button>
        </nav>
      </header>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="container mx-auto flex h-full max-w-6xl flex-col px-4 py-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h1 className="mb-1 font-mono text-3xl font-bold tracking-tight">
                Projects
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your video processing workspaces.
              </p>
            </div>

            <Dialog
              open={open}
              onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) form.reset();
              }}
            >
              <DialogTrigger asChild>
                <Button className="font-mono text-xs uppercase tracking-wider" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Start a new FrameForge workspace for video editing and analysis.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4 pt-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Q4 Marketing Campaign" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief notes about this project..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="pt-4">
                      <Button type="submit">Create Project</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-card/20 py-20 text-center">
              <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
              <h2 className="mb-1 text-lg font-medium text-foreground">
                No projects yet
              </h2>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                Create your first project to start extracting frames, comparing AI
                outputs, and masking regions.
              </p>
              <Button
                onClick={() => setOpen(true)}
                variant="outline"
                className="font-mono text-xs uppercase tracking-wider"
              >
                Create Project
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
