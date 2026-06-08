import { Layout } from "@/components/layout";
import { useGetProject, useUpdateProject, useDeleteProject, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Save, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const updateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export function ProjectSettings() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: project, isLoading } = useGetProject(projectId, { 
    query: { enabled: !!projectId } 
  });
  
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const initialized = useRef(false);
  
  useEffect(() => {
    if (project && !initialized.current) {
      form.reset({
        name: project.name,
        description: project.description || "",
      });
      initialized.current = true;
    }
  }, [project, form]);

  function onSubmit(values: z.infer<typeof updateSchema>) {
    updateProject.mutate({
      id: projectId,
      data: values,
    }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetProjectQueryKey(projectId), data);
      }
    });
  }

  function onDelete() {
    deleteProject.mutate({ id: projectId }, {
      onSuccess: () => {
        setLocation("/");
      }
    });
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-2xl py-8">
          <Skeleton className="h-8 w-64 mb-6 bg-card" />
          <Skeleton className="h-64 w-full bg-card" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl py-8 px-4 h-full overflow-y-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-3 text-muted-foreground hover:text-foreground">
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Workspace
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">Project Settings</h1>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Update your project metadata.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-background" />
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="bg-background resize-none h-24" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={updateProject.isPending || !form.formState.isDirty}>
                      <Save className="w-4 h-4 mr-2" />
                      {updateProject.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="bg-destructive/5 border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Permanently delete this project and all its data.</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your project
                      "{project?.name}" and remove all associated data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}