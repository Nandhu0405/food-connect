import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Package, Phone, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/donations/$id")({
  head: () => ({ meta: [{ title: "Donation — Food Rescue Network" }] }),
  component: DonationDetail,
});

function DonationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["donation", id],
    queryFn: async () => {
      const { data: d, error } = await supabase
        .from("donations").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: donor } = await supabase
        .from("profiles").select("display_name, org_name, phone").eq("id", d.donor_id).maybeSingle();
      return { donation: d, donor };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["donation", id] });

  const claim = async () => {
    if (!user) return;
    const { error: e1 } = await supabase
      .from("donations")
      .update({ status: "claimed", claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", id);
    if (e1) return toast.error(e1.message);
    await supabase.from("donation_claims").insert({ donation_id: id, ngo_id: user.id });
    toast.success("Claimed — the donor has been notified.");
    invalidate();
  };

  const updateStatus = async (status: "picked_up" | "completed" | "cancelled") => {
    const { error } = await supabase.from("donations").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (data?.donation.claimed_by) {
      await supabase
        .from("donation_claims")
        .update({ status: status === "cancelled" ? "cancelled" : status })
        .eq("donation_id", id)
        .eq("ngo_id", data.donation.claimed_by);
    }
    toast.success("Updated.");
    invalidate();
  };

  if (isLoading || !data) {
    return <div className="container-page py-20 text-center text-muted-foreground">Loading…</div>;
  }

  const d = data.donation;
  const isDonor = user?.id === d.donor_id;
  const isClaimer = user?.id === d.claimed_by;
  const canClaim = (role === "ngo" || role === "volunteer") && d.status === "available" && !isDonor;

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
                <p className="text-xs text-muted-foreground">Contact info appears once you claim this rescue.</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-serif text-xl">Actions</h3>
            <div className="mt-4 space-y-2">
              {canClaim && (
                <Button onClick={claim} size="lg" className="w-full">Claim this rescue</Button>
              )}
              {isClaimer && d.status === "claimed" && (
                <Button onClick={() => updateStatus("picked_up")} size="lg" className="w-full">Mark as picked up</Button>
              )}
              {(isClaimer || isDonor) && d.status === "picked_up" && (
                <Button onClick={() => updateStatus("completed")} size="lg" className="w-full">Mark as delivered</Button>
              )}
              {(isDonor || isClaimer) && d.status !== "completed" && d.status !== "cancelled" && (
                <Button onClick={() => updateStatus("cancelled")} size="lg" variant="outline" className="w-full">Cancel</Button>
              )}
              {!canClaim && d.status === "available" && !isDonor && (
                <p className="text-sm text-muted-foreground">Only NGOs and volunteers can claim donations.</p>
              )}
              {d.status === "completed" && (
                <p className="text-sm text-sage-deep">✓ Delivered. Thank you for closing the loop.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
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
