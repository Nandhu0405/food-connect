import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { applyAsVolunteer } from "@/lib/volunteers.functions";

export const Route = createFileRoute("/_authenticated/volunteers/apply")({
  head: () => ({ meta: [{ title: "Volunteer Application — Food Rescue Network" }] }),
  component: VolunteerApplyPage,
});

function VolunteerApplyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const apply = useServerFn(applyAsVolunteer);
  const [submitting, setSubmitting] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["my-volunteer-app", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("volunteer_applications").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await apply({
        data: {
          full_name: String(fd.get("full_name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          vehicle_type: String(fd.get("vehicle_type") ?? "bike") as "bike",
          license_number: String(fd.get("license_number") ?? "") || null,
          city: String(fd.get("city") ?? "") || null,
        },
      });
      toast.success("Application submitted — we'll review shortly.");
      qc.invalidateQueries({ queryKey: ["my-volunteer-app", user?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page max-w-2xl py-10 lg:py-14">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Truck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-serif text-4xl">Volunteer / Driver</h1>
          <p className="text-muted-foreground">Help rescue food by picking up and delivering donations.</p>
        </div>
      </div>

      {existing && (
        <Card className="mt-6 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Application status</div>
              <div className="mt-1 font-serif text-2xl capitalize">{existing.status}</div>
            </div>
            <Badge variant={existing.status === "approved" ? "default" : existing.status === "rejected" ? "destructive" : "secondary"}>
              {existing.status}
            </Badge>
          </div>
          {existing.notes && <p className="mt-2 text-sm text-muted-foreground">{existing.notes}</p>}
          {existing.status === "approved" && (
            <Button className="mt-4" onClick={() => navigate({ to: "/volunteers/my" })}>Go to my assignments</Button>
          )}
        </Card>
      )}

      <Card className="mt-6 p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" required defaultValue={existing?.full_name ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" required defaultValue={existing?.phone ?? ""} />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={existing?.city ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vehicle_type">Vehicle</Label>
              <Select name="vehicle_type" defaultValue={existing?.vehicle_type ?? "bike"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walking">Walking</SelectItem>
                  <SelectItem value="bike">Bicycle</SelectItem>
                  <SelectItem value="scooter">Scooter</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="license_number">Driver's license #</Label>
              <Input id="license_number" name="license_number" defaultValue={existing?.license_number ?? ""} />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : existing ? "Resubmit application" : "Submit application"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
