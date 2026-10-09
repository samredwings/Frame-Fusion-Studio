import "./_group.css";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Clapperboard,
  EyeOff,
  FolderOpen,
  Home,
  Layers,
  Plus,
  Scissors,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
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

type StatProps = {
  icon: typeof Video;
  label: string;
  value: number;
};

function ProjectStat({ icon: Icon, label, value }: StatProps) {
  return (
    <div className="ff-stat">
      <Icon aria-hidden="true" className="ff-stat-icon" />
      <span className="ff-stat-value">{value}</span>
      <span className="ff-stat-label">{label}</span>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const isActive = project.status === "active";
  const date = new Date(project.createdAt).toLocaleDateString();

  return (
    <article className={`ff-project-card${isActive ? " is-active" : ""}`}>
      <div className="ff-card-topline">
        <span className="ff-card-kind">
          <Clapperboard aria-hidden="true" />
          Video project
        </span>
        <span
          className={`ff-status${isActive ? " is-active" : ""}`}
          aria-label={`Status: ${project.status}`}
        >
          <span className="ff-status-dot" aria-hidden="true" />
          {project.status}
        </span>
      </div>

      <div className="ff-project-heading">
        <h2 className="ff-project-name">{project.name}</h2>
        <p className="ff-project-description">
          {project.description || "No description"}
        </p>
      </div>

      <div className="ff-stats" aria-label="Project work">
        <ProjectStat
          icon={Video}
          label="Sources"
          value={project.stats.sourceCount}
        />
        <ProjectStat
          icon={Scissors}
          label="Edits"
          value={project.stats.frameEditCount}
        />
        <ProjectStat
          icon={Layers}
          label="Regions"
          value={project.stats.blurRegionCount}
        />
        <ProjectStat
          icon={EyeOff}
          label="Masked"
          value={project.stats.maskedRegionCount}
        />
      </div>

      <footer className="ff-card-footer">
        <span>Created {date}</span>
        <span className="ff-fps">{project.fps || 30} FPS</span>
      </footer>
    </article>
  );
}

export function Polished() {
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
        description: values.description?.trim() ?? "",
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

  function handleDialogChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) form.reset();
  }

  return (
    <div className="dark ff-polished min-h-[100dvh] w-full bg-background text-foreground">
      <style>{`
        .ff-polished {
          --ff-ink: 210 19% 91%;
          --ff-muted: 216 9% 62%;
          --ff-line: 220 10% 17%;
          --ff-panel: 222 11% 8%;
          --ff-panel-raised: 222 10% 10%;
          --ff-accent: 25 78% 59%;
          --ff-accent-soft: 25 40% 16%;
          min-height: 100dvh;
          background:
            radial-gradient(ellipse at 50% -26%, hsl(223 13% 13% / .8), transparent 58%),
            hsl(228 11% 5%);
          color: hsl(var(--ff-ink));
          font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
        }
        .ff-polished *, .ff-polished *::before, .ff-polished *::after { box-sizing: border-box; }
        .ff-polished :focus-visible {
          outline: 2px solid hsl(var(--ff-accent));
          outline-offset: 3px;
        }
        .ff-topbar {
          display: flex;
          align-items: center;
          min-height: 64px;
          padding: 0 clamp(18px, 4.5vw, 72px);
          border-bottom: 1px solid hsl(var(--ff-line) / .8);
          background: hsl(225 12% 7% / .82);
        }
        .ff-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: hsl(var(--ff-ink));
          font-size: 13px;
          font-weight: 750;
          letter-spacing: .12em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ff-brand-mark {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          color: hsl(var(--ff-accent));
          border: 1px solid hsl(var(--ff-accent) / .35);
          border-radius: 8px;
          background: hsl(var(--ff-accent) / .08);
        }
        .ff-brand-mark svg { width: 16px; height: 16px; stroke-width: 1.8; }
        .ff-nav {
          display: flex;
          align-items: center;
          align-self: stretch;
          margin-left: clamp(26px, 5vw, 70px);
        }
        .ff-nav-item {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 64px;
          padding: 0 4px;
          color: hsl(var(--ff-ink) / .88);
          font-size: 13px;
          font-weight: 550;
        }
        .ff-nav-item::after {
          position: absolute;
          right: 0;
          bottom: -1px;
          left: 0;
          height: 2px;
          background: hsl(var(--ff-accent));
          content: "";
        }
        .ff-nav-item svg { width: 15px; height: 15px; color: hsl(var(--ff-accent)); }
        .ff-main {
          width: min(100% - 40px, 1192px);
          margin: 0 auto;
          padding: clamp(38px, 6vw, 70px) 0 72px;
        }
        .ff-heading-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 34px;
        }
        .ff-eyebrow {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0 0 12px;
          color: hsl(var(--ff-muted));
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .ff-eyebrow::before {
          width: 18px;
          height: 1px;
          background: hsl(var(--ff-accent) / .75);
          content: "";
        }
        .ff-title {
          margin: 0;
          font-size: clamp(30px, 4vw, 42px);
          font-weight: 650;
          letter-spacing: -.045em;
          line-height: 1.06;
        }
        .ff-subtitle {
          margin: 11px 0 0;
          color: hsl(var(--ff-muted));
          font-size: 14px;
          line-height: 1.55;
        }
        .ff-new-button {
          min-height: 42px;
          padding: 0 17px;
          border: 1px solid hsl(var(--ff-accent) / .5) !important;
          border-radius: 7px !important;
          background: hsl(var(--ff-accent)) !important;
          box-shadow: 0 5px 18px hsl(var(--ff-accent) / .11);
          color: hsl(222 17% 9%) !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          letter-spacing: .04em;
          transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
        }
        .ff-new-button:hover { transform: translateY(-1px); background: hsl(25 80% 64%) !important; box-shadow: 0 7px 20px hsl(var(--ff-accent) / .18); }
        .ff-new-button svg { width: 16px; height: 16px; margin-right: 8px; }
        .ff-library-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 40px;
          margin-bottom: 13px;
          border-top: 1px solid hsl(var(--ff-line) / .72);
          color: hsl(var(--ff-muted));
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 10px;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .ff-library-total { color: hsl(var(--ff-muted) / .72); letter-spacing: .05em; }
        .ff-project-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .ff-project-card {
          position: relative;
          display: flex;
          min-width: 0;
          min-height: 263px;
          flex-direction: column;
          overflow: hidden;
          padding: 19px 19px 0;
          border: 1px solid hsl(var(--ff-line));
          border-radius: 9px;
          background: linear-gradient(145deg, hsl(var(--ff-panel-raised)), hsl(var(--ff-panel)) 68%);
          transition: border-color 170ms ease, transform 170ms ease, background-color 170ms ease;
        }
        .ff-project-card:hover {
          transform: translateY(-2px);
          border-color: hsl(var(--ff-accent) / .42);
          background: linear-gradient(145deg, hsl(222 11% 11%), hsl(var(--ff-panel)) 74%);
        }
        .ff-project-card.is-active { border-color: hsl(var(--ff-accent) / .32); }
        .ff-project-card.is-active::before {
          position: absolute;
          top: 0;
          left: 19px;
          width: 35px;
          height: 2px;
          background: hsl(var(--ff-accent));
          content: "";
        }
        .ff-card-topline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .ff-card-kind {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: hsl(var(--ff-muted) / .82);
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 9px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .ff-card-kind svg { width: 13px; height: 13px; color: hsl(var(--ff-muted) / .7); }
        .ff-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
          padding: 5px 8px;
          border: 1px solid hsl(var(--ff-line));
          border-radius: 4px;
          background: hsl(220 12% 10% / .8);
          color: hsl(var(--ff-muted));
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 9px;
          letter-spacing: .06em;
          line-height: 1;
          text-transform: uppercase;
        }
        .ff-status.is-active { border-color: hsl(var(--ff-accent) / .22); background: hsl(var(--ff-accent-soft) / .4); color: hsl(27 75% 72%); }
        .ff-status-dot { width: 5px; height: 5px; border-radius: 50%; background: hsl(218 7% 48%); }
        .ff-status.is-active .ff-status-dot { background: hsl(var(--ff-accent)); }
        .ff-project-heading { min-height: 87px; padding-top: 21px; }
        .ff-project-name {
          overflow-wrap: anywhere;
          margin: 0;
          color: hsl(var(--ff-ink));
          font-size: 17px;
          font-weight: 620;
          letter-spacing: -.025em;
          line-height: 1.25;
        }
        .ff-project-description {
          display: -webkit-box;
          overflow: hidden;
          margin: 7px 0 0;
          color: hsl(var(--ff-muted));
          font-size: 11px;
          line-height: 1.5;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        .ff-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin: 5px 0 17px;
        }
        .ff-stat {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 7px;
          min-height: 34px;
          padding: 0 9px;
          border: 1px solid hsl(220 10% 18% / .68);
          border-radius: 5px;
          background: hsl(225 13% 5% / .42);
          color: hsl(var(--ff-muted));
          font-size: 10px;
          white-space: nowrap;
        }
        .ff-stat-icon { width: 13px; height: 13px; flex: 0 0 auto; color: hsl(var(--ff-accent) / .82); }
        .ff-stat-value { color: hsl(var(--ff-ink) / .9); font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; }
        .ff-stat-label { overflow: hidden; text-overflow: ellipsis; }
        .ff-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 42px;
          margin-top: auto;
          border-top: 1px solid hsl(var(--ff-line) / .76);
          color: hsl(var(--ff-muted) / .78);
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 9px;
          letter-spacing: .015em;
        }
        .ff-fps { color: hsl(var(--ff-muted)); }
        .ff-empty {
          display: flex;
          min-height: 300px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 36px 20px;
          border: 1px dashed hsl(var(--ff-line));
          border-radius: 9px;
          background: hsl(var(--ff-panel) / .48);
          text-align: center;
        }
        .ff-empty-icon {
          display: grid;
          width: 48px;
          height: 48px;
          margin-bottom: 16px;
          place-items: center;
          border: 1px solid hsl(var(--ff-line));
          border-radius: 12px;
          color: hsl(var(--ff-accent) / .9);
          background: hsl(var(--ff-accent) / .07);
        }
        .ff-empty-icon svg { width: 21px; height: 21px; }
        .ff-empty h2 { margin: 0; font-size: 16px; font-weight: 620; }
        .ff-empty p { max-width: 360px; margin: 8px 0 19px; color: hsl(var(--ff-muted)); font-size: 12px; line-height: 1.6; }
        .ff-dialog :is(input, textarea) { border-color: hsl(var(--ff-line)); background: hsl(228 11% 7%); }
        .ff-dialog :is(input, textarea):focus-visible { outline: 2px solid hsl(var(--ff-accent)); outline-offset: 2px; }
        .ff-dialog-submit { background: hsl(var(--ff-accent)) !important; color: hsl(222 17% 9%) !important; font-weight: 700 !important; }
        @media (max-width: 920px) {
          .ff-project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ff-main { width: min(100% - 36px, 760px); }
        }
        @media (max-width: 600px) {
          .ff-topbar { min-height: 58px; padding: 0 18px; }
          .ff-nav { margin-left: auto; }
          .ff-nav-item { min-height: 58px; font-size: 12px; }
          .ff-main { width: calc(100% - 36px); padding: 37px 0 48px; }
          .ff-heading-row { align-items: flex-start; flex-direction: column; gap: 20px; margin-bottom: 28px; }
          .ff-new-button { width: 100%; }
          .ff-project-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
          .ff-project-card { min-height: 248px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ff-polished *, .ff-polished *::before, .ff-polished *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      <header className="ff-topbar">
        <div className="ff-brand" aria-label="FrameForge">
          <span className="ff-brand-mark">
            <Clapperboard aria-hidden="true" />
          </span>
          <span>FrameForge</span>
        </div>
        <nav className="ff-nav" aria-label="Main navigation">
          <span className="ff-nav-item" aria-current="page">
            <Home aria-hidden="true" />
            Dashboard
          </span>
        </nav>
      </header>

      <main className="ff-main">
        <div className="ff-heading-row">
          <div>
            <p className="ff-eyebrow">FrameForge / Workspace</p>
            <h1 className="ff-title">Projects</h1>
            <p className="ff-subtitle">
              Manage your video processing workspaces.
            </p>
          </div>

          <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button type="button" className="ff-new-button">
                <Plus aria-hidden="true" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="ff-dialog sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Start a new FrameForge workspace for video editing and analysis.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 pt-3"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input
                            autoFocus
                            placeholder="e.g. Studio interview selects"
                            {...field}
                          />
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
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-2">
                    <Button type="submit" className="ff-dialog-submit">
                      Create Project
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <section aria-labelledby="project-library-heading">
          <div className="ff-library-label">
            <h2 id="project-library-heading" className="m-0 font-inherit">
              Project library
            </h2>
            <span className="ff-library-total">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </div>

          {projects.length > 0 ? (
            <div className="ff-project-grid">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="ff-empty">
              <span className="ff-empty-icon">
                <FolderOpen aria-hidden="true" />
              </span>
              <h2>No projects yet</h2>
              <p>
                Create your first project to start extracting frames, comparing
                AI outputs, and masking regions.
              </p>
              <Button
                type="button"
                className="ff-new-button"
                onClick={() => setOpen(true)}
              >
                <Plus aria-hidden="true" />
                Create Project
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
