import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, MapPin, Package, Phone, Sparkles, Truck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listApprovedVolunteers, suggestNgoMatches } from "@/lib/matching.functions";
import { acceptDonation, assignVolunteer } from "@/lib/lifecycle.functions";
import { StatusTimeline, type TimelineEntry } from "@/components/StatusTimeline";

export const Route = createFileRoute("/_authenticated/donations/$id")({
  head: () => ({ meta: [{ title: "Donation — Food Rescue Network" }] }),
  component: DonationDetail,
});

interface MatchRow {
  ngo_id: string;
  name: string;
  city: string | null;
  score: number;
  breakdown: { distance: number; foodType: number; quantity: number; capacity: number; urgency: number; expiry: number };
  reason: string;
}

function DonationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const runMatch = useServerFn(suggestNgoMatches);
  const accept = useServerFn(acceptDonation);
  const assign = useServerFn(assignVolunteer);
  const listVols = useServerFn(listApprovedVolunteers);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [selectedVol, setSelectedVol] = useState<string>("");

  useEffect(() => {
    const ch = supabase
      .channel(`donation-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "donations", filter: `id=eq.${id}` }, () => invalidate())
      .on("postgres_changes", { event: "*", schema: "public", table: "donation_status_history", filter: `donation_id=eq.${id}` }, () => invalidate())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments", filter: `donation_id=eq.${id}` }, () => invalidate())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { data, isLoading } = useQuery({
    queryKey: ["donation", id],
    queryFn: async () => {
      const { data: d, error } = await supabase.from("donations").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: donor } = await supabase.from("profiles").select("display_name, org_name, phone").eq("id", d.donor_id).maybeSingle();
      const { data: history } = await supabase
        .from("donation_status_history")
        .select("to_status, created_at, notes")
        .eq("donation_id", id)
        .order("created_at", { ascending: true });
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id, volunteer_id, status, assigned_at, picked_up_at, delivered_at, proof_url")
        .eq("donation_id", id)
        .maybeSingle();
      return { donation: d, donor, history: history ?? [], assignment };
    },
  });

  const { data: vols } = useQuery({
    queryKey: ["approved-vols"],
    queryFn: () => listVols(),
    enabled: !!user && data?.donation?.claimed_by === user?.id && !data?.assignment,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["donation", id] });

  const onAccept = async () => {
    try { await accept({ data: { donationId: id } }); toast.success("Accepted — donor notified."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const onAssign = async () => {
    if (!selectedVol) return toast.error("Pick a volunteer");
    try {
      await assign({ data: { donationId: id, volunteerId: selectedVol } });
      toast.success("Volunteer assigned");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const onSuggest = async () => {
    setMatching(true);
    try {
      const res = await runMatch({ data: { donationId: id } });
      setMatches(res.matches);
      if (res.matches.length === 0) toast.info("No NGO partners found yet.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Match failed"); }
    finally { setMatching(false); }
  };

  if (isLoading || !data) {
    return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  }

  const d = data.donation;
  const isDonor = user?.id === d.donor_id;
  const isClaimer = user?.id === d.claimed_by;
  const canAccept = (role === "ngo" || role === "admin") && d.status === "available" && !isDonor;

  const timeline: TimelineEntry[] = (data.history as Array<{ to_status: string; created_at: string; notes: string | null }>).map((h) => ({
    status: h.to_status,
    at: h.created_at,
    note: h.notes,
  }));

  return (
    <div className="container-page py-10 lg:py-14">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/donations" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> All rescues
      </Button>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-border/60 bg-secondary">
            {d.image_url ? (
              <img src={d.image_url} alt={d.title} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-sage/40 to-accent">
                <Package className="h-16 w-16 text-sage-deep/60" />
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-serif text-4xl">{d.title}</h1>
            <Badge className="capitalize" variant="outline">{d.status.replace("_", " ")}</Badge>
          </div>
          {d.description && <p className="mt-4 leading-relaxed text-muted-foreground">{d.description}</p>}

          <Separator className="my-8" />

          <dl className="grid gap-5 sm:grid-cols-2">
            <Info icon={<Package className="h-4 w-4" />} label="Quantity" value={`${d.quantity} ${d.unit} • ${d.food_type}`} />
            <Info icon={<MapPin className="h-4 w-4" />} label="Pickup" value={`${d.pickup_address}${d.city ? `, ${d.city}` : ""}`} />
            <Info icon={<Clock className="h-4 w-4" />} label="Pickup window" value={`${format(new Date(d.pickup_from), "PP p")} → ${format(new Date(d.pickup_to), "p")}`} />
            <Info icon={<Clock className="h-4 w-4" />} label="Best before" value={format(new Date(d.expires_at), "PP p")} />
          </dl>

          <Separator className="my-8" />

          <div>
            <h2 className="font-serif text-2xl">Progress</h2>
            <p className="text-sm text-muted-foreground">Real-time updates as the rescue moves forward.</p>
            <div className="mt-5">
              <StatusTimeline entries={timeline} current={d.status} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-serif text-xl">Donor</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span>{data.donor?.org_name || data.donor?.display_name || "Anonymous donor"}</span>
              </div>
              {data.donor?.phone && (d.status !== "available" || isDonor) && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${data.donor.phone}`} className="text-primary hover:underline">{data.donor.phone}</a>
                </div>
              )}
              {data.donor?.phone && d.status === "available" && !isDonor && (
                <p className="text-xs text-muted-foreground">Contact info appears once accepted.</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-serif text-xl">Actions</h3>
            <div className="mt-4 space-y-2">
              {canAccept && (
                <Button onClick={onAccept} size="lg" className="w-full">Accept this donation</Button>
              )}
              {isClaimer && d.status === "claimed" && !data.assignment && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Assign an approved volunteer to handle pickup.</p>
                  <Select value={selectedVol} onValueChange={setSelectedVol}>
                    <SelectTrigger><SelectValue placeholder="Select volunteer" /></SelectTrigger>
                    <SelectContent>
                      {(vols?.volunteers ?? []).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No approved volunteers yet</div>
                      )}
                      {(vols?.volunteers ?? []).map((v) => (
                        <SelectItem key={v.user_id} value={v.user_id}>
                          {v.full_name} • {v.vehicle_type}{v.city ? ` • ${v.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={onAssign} className="w-full" disabled={!selectedVol}>
                    <Truck className="mr-2 h-4 w-4" /> Assign volunteer
                  </Button>
                </div>
              )}
              {data.assignment && (
                <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 text-sm">
                  <div className="font-medium">Volunteer assigned</div>
                  <div className="text-xs capitalize text-muted-foreground">Status: {data.assignment.status.replace("_", " ")}</div>
                  {data.assignment.proof_url && (
                    <div className="mt-1 text-xs text-sage-deep">✓ Proof of delivery uploaded</div>
                  )}
                </div>
              )}
              {d.status === "completed" && (
                <p className="text-sm text-sage-deep">✓ Delivered. Thank you for closing the loop.</p>
              )}
            </div>
          </Card>

          {isDonor && d.status === "available" && (
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-serif text-xl">AI NGO matches</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Weighted by distance, food type, quantity, capacity, urgency, and expiry.
              </p>
              <Button onClick={onSuggest} disabled={matching} className="mt-4 w-full" variant="outline">
                {matching ? "Computing matches…" : "Suggest NGOs"}
              </Button>
              {matches && matches.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {matches.map((m) => (
                    <li key={m.ngo_id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{m.name}</div>
                        <Badge variant="secondary">{m.score}</Badge>
                      </div>
                      {m.city && <div className="text-xs text-muted-foreground">{m.city}</div>}
                      <p className="mt-1 text-sm text-muted-foreground">{m.reason}</p>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Stat label="Dist" v={m.breakdown.distance} />
                        <Stat label="Food" v={m.breakdown.foodType} />
                        <Stat label="Qty" v={m.breakdown.quantity} />
                        <Stat label="Cap" v={m.breakdown.capacity} />
                        <Stat label="Urg" v={m.breakdown.urgency} />
                        <Stat label="Exp" v={m.breakdown.expiry} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded bg-secondary/60 px-1.5 py-1 text-center">
      <div>{label}</div>
      <div className="text-sm font-semibold text-foreground">{v}</div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground">{icon}</span>
      <div>
        <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}
