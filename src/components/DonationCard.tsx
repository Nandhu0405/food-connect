import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistanceToNowStrict } from "date-fns";

export type DonationRow = {
  id: string;
  title: string;
  description: string | null;
  food_type: string;
  quantity: number;
  unit: string;
  pickup_address: string;
  city: string | null;
  pickup_to: string;
  expires_at: string;
  status: string;
  image_url: string | null;
};

const statusStyles: Record<string, string> = {
  available: "bg-primary/10 text-primary border-primary/30",
  claimed: "bg-clay/15 text-clay border-clay/40",
  picked_up: "bg-sage/30 text-sage-deep border-sage-deep/30",
  completed: "bg-muted text-muted-foreground border-border",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function DonationCard({ d }: { d: DonationRow }) {
  return (
    <Link to="/donations/$id" params={{ id: d.id }} className="group">
      <Card className="overflow-hidden border-border/70 bg-card p-0 transition hover:border-sage-deep/50 hover:shadow-lg">
        <div className="aspect-[16/10] overflow-hidden bg-secondary">
          {d.image_url ? (
            <img
              src={d.image_url}
              alt={d.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sage/40 to-accent">
              <Package className="h-10 w-10 text-sage-deep/60" />
            </div>
          )}
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-xl leading-tight">{d.title}</h3>
            <Badge variant="outline" className={statusStyles[d.status] ?? ""}>
              {d.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {d.description ?? `${d.food_type} • ${d.quantity} ${d.unit}`}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              {d.quantity} {d.unit}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {d.city ?? d.pickup_address.split(",")[0]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              expires {formatDistanceToNowStrict(new Date(d.expires_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
