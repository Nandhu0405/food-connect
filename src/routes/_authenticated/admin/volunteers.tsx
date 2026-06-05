import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { reviewVolunteer } from "@/lib/volunteers.functions";

export const Route = createFileRoute("/_authenticated/admin/volunteers")({
  head: () => ({ meta: [{ title: "Volunteer Approvals — Admin" }] }),
  component: AdminVolunteers,
});

function AdminVolunteers() {
  const { role, loading } = useAuth();
  const qc = useQueryClient();
  const review = useServerFn(reviewVolunteer);

  const { data } = useQuery({
    queryKey: ["admin-volunteer-apps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("volunteer_applications")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: role === "admin",
  });

  if (loading) return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  const decide = async (id: string, decision: "approved" | "rejected") => {
    try {
      await review({ data: { id, decision } });
      toast.success(`Application ${decision}`);
      qc.invalidateQueries({ queryKey: ["admin-volunteer-apps"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></span>
        <div>
          <h1 className="font-serif text-4xl">Volunteer applications</h1>
          <p className="text-muted-foreground">Approve or reject incoming volunteers.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {(data ?? []).length === 0 ? (
          <Card className="border-dashed bg-secondary/40 p-12 text-center text-muted-foreground">No applications yet.</Card>
        ) : (
          (data ?? []).map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-xl">{a.full_name}</h3>
                    <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>
                      {a.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {a.phone} • {a.vehicle_type}{a.city ? ` • ${a.city}` : ""}
                    {a.license_number ? ` • License ${a.license_number}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Submitted {format(new Date(a.created_at), "PP p")}
                  </div>
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-2">
                    <Button onClick={() => decide(a.id, "approved")}>Approve</Button>
                    <Button variant="outline" onClick={() => decide(a.id, "rejected")}>Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
