import { Check, Circle } from "lucide-react";
import { format } from "date-fns";

export interface TimelineEntry {
  status: string;
  at: string;
  note?: string | null;
}

const ORDER = ["available", "claimed", "assigned", "picked_up", "completed"];
const LABELS: Record<string, string> = {
  available: "Pending",
  claimed: "Accepted",
  assigned: "Assigned",
  picked_up: "Picked Up",
  completed: "Delivered",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function StatusTimeline({ entries, current }: { entries: TimelineEntry[]; current: string }) {
  const reachedIdx = ORDER.indexOf(current);
  const byStatus = new Map<string, TimelineEntry>();
  entries.forEach((e) => byStatus.set(e.status, e));

  return (
    <ol className="relative space-y-5 border-l-2 border-border/60 pl-6">
      {ORDER.map((status, idx) => {
        const reached = reachedIdx >= idx && current !== "cancelled";
        const entry = byStatus.get(status);
        const active = current === status;
        return (
          <li key={status} className="relative">
            <span
              className={`absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full border-2 ${
                reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
              } ${active ? "ring-4 ring-primary/20" : ""}`}
            >
              {reached ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className={`font-medium ${active ? "text-primary" : reached ? "text-foreground" : "text-muted-foreground"}`}>
                {LABELS[status]}
              </div>
              {entry && (
                <div className="text-xs text-muted-foreground">
                  {format(new Date(entry.at), "PP p")}
                  {entry.note ? ` • ${entry.note}` : ""}
                </div>
              )}
            </div>
          </li>
        );
      })}
      {current === "cancelled" && (
        <li className="relative">
          <span className="absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
            <Circle className="h-3 w-3" />
          </span>
          <div className="font-medium text-destructive">Cancelled</div>
        </li>
      )}
    </ol>
  );
}
