import { useListProjects, useCreateProject, useGetProjectStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Video, Scissors, Layers, EyeOff, FolderOpen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

function ProjectCard({ project }: { project: any }) {
  const { data: stats, isLoading } = useGetProjectStats(project.id, { query: { enabled: !!project.id } });

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover-elevate cursor-pointer transition-colors border-border/50 hover:border-primary/50 group bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-base group-hover:text-primary transition-colors">{project.name}</CardTitle>
              <CardDescription className="text-xs line-clamp-1">{project.description || "No description"}</CardDescription>
            </div>
            <div className="text-xs uppercase tracking-wider font-mono px-2 py-1 rounded bg-secondary/50 text-muted-foreground">
              {project.status}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 bg-background/50 p-2 rounded">
              <Video className="w-3.5 h-3.5 text-primary/70" />
              <span>{isLoading ? "-" : stats?.sourceCount || 0} Sources</span>
            </div>
            <div className="flex items-center gap-1.5 bg-background/50 p-2 rounded">
              <Scissors className="w-3.5 h-3.5 text-chart-2/70" />
              <span>{isLoading ? "-" : stats?.frameEditCount || 0} Edits</span>
            </div>
            <div className="flex items-center gap-1.5 bg-background/50 p-2 rounded">
              <Layers className="w-3.5 h-3.5 text-chart-3/70" />
              <span>{isLoading ? "-" : stats?.blurRegionCount || 0} Regions</span>
            </div>
            <div className="flex items-center gap-1.5 bg-background/50 p-2 rounded">
              <EyeOff className="w-3.5 h-3.5 text-chart-4/70" />
              <span>{isLoading ? "-" : stats?.maskedRegionCount || 0} Masked</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-0 text-[10px] text-muted-foreground flex justify-between">
          <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
          <span>{project.fps || 30} FPS</span>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function Dashboard() {
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  function onSubmit(values: z.infer<typeof createProjectSchema>) {
    createProject.mutate({
      data: {
        name: values.name,
        description: values.description,
      }
    }, {
      onSuccess: (project) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setOpen(false);
        setLocation(`/projects/${project.id}`);
      }
    });
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl py-8 px-4 h-full flex flex-col">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 font-mono">Projects</h1>
            <p className="text-muted-foreground text-sm">Manage your video processing workspaces.</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono uppercase text-xs tracking-wider" size="sm">
                <Plus className="w-4 h-4 mr-2" />
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
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
                          <Textarea placeholder="Brief notes about this project..." className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-4">
                    <Button type="submit" disabled={createProject.isPending}>
                      {createProject.isPending ? "Creating..." : "Create Project"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[180px] w-full bg-card border-border/50" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg bg-card/20 py-20 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create your first project to start extracting frames, comparing AI outputs, and masking regions.
            </p>
            <Button onClick={() => setOpen(true)} variant="outline" className="font-mono text-xs uppercase tracking-wider">
              Create Project
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}