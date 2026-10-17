import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

// Status is always shown with colour and text (design rules).
const STYLES: Record<JobStatus, string> = {
  unplanned: "bg-warning/12 text-warning",
  scheduled: "bg-primary-soft text-primary",
  in_progress: "bg-primary text-primary-foreground",
  waiting_material: "bg-warning/12 text-warning",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-danger/10 text-danger",
};

export function JobStatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status in STYLES ? status : "unplanned") as JobStatus;
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold", STYLES[key], className)}>
      {JOB_STATUS_LABELS[key]}
    </span>
  );
}
