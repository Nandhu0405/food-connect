import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { MapPin, Package, Truck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { confirmDelivery, confirmPickup } from "@/lib/lifecycle.functions";

export const Route = createFileRoute("/_authenticated/volunteers/my")({
  head: () => ({ meta: [{ title: "My Assignments — Food Rescue Network" }] }),
  component: MyAssignments,
});

interface Row {
  id: string;
  donation_id: string;
  status: string;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  proof_url: string | null;
  donations: {
    title: string;
    pickup_address: string;
    city: string | null;
    pickup_from: string;
    pickup_to: string;
    quantity: number;
    unit: string;
    food_type: string;
  } | null;
}

function MyAssignments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pickup = useServerFn(confirmPickup);
  const deliver = useServerFn(confirmDelivery);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("my-assignments-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments", filter: `volunteer_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-assignments", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const { data } = useQuery({
    queryKey: ["my-assignments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, donation_id, status, assigned_at, picked_up_at, delivered_at, proof_url, donations(title,pickup_address,city,pickup_from,pickup_to,quantity,unit,food_type)")
        .eq("volunteer_id", user!.id)
        .order("assigned_at", { ascending: false });
      return (data ?? []) as unknown as Row[];
    },
    enabled: !!user,
  });

  const onPickup = async (id: string) => {
    try { await pickup({ data: { assignmentId: id } }); toast.success("Pickup confirmed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const onDeliver = async (id: string, file?: File | null) => {
    let proofPath: string | undefined;
    if (file) {
      setUploading(id);
      const ext = file.name.split(".").pop() || "jpg";
      proofPath = `${user!.id}/${id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("delivery-proofs").upload(proofPath, file, { upsert: false });
      setUploading(null);
      if (error) return toast.error(`Upload failed: ${error.message}`);
    }
    try {
      await deliver({ data: { assignmentId: id, proofPath } });
      toast.success("Delivery completed — great work!");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Truck className="h-6 w-6" /></span>
        <div>
          <h1 className="font-serif text-4xl">My pickups</h1>
          <p className="text-muted-foreground">Track and complete your assignments.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {(data ?? []).length === 0 ? (
          <Card className="border-dashed bg-secondary/40 p-12 text-center text-muted-foreground">
            No assignments yet. Check back soon.
          </Card>
        ) : (
          (data ?? []).map((a) => {
            const d = a.donations;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-2xl">{d?.title ?? "Donation"}</h3>
                      <Badge variant="outline" className="capitalize">{a.status.replace("_", " ")}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="h-4 w-4" />{d?.quantity} {d?.unit} • {d?.food_type}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{d?.pickup_address}{d?.city ? `, ${d.city}` : ""}</span>
                    </div>
                    {d && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pickup window: {format(new Date(d.pickup_from), "PP p")} → {format(new Date(d.pickup_to), "p")}
                      </p>
                    )}
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/donations/${a.donation_id}`}>Details</Link>
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {a.status === "assigned" && (
                    <Button onClick={() => onPickup(a.id)}>Confirm pickup</Button>
                  )}
                  {a.status === "picked_up" && (
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onDeliver(a.id, e.currentTarget.files?.[0])}
                      />
                      <Button asChild disabled={uploading === a.id}>
                        <span><Upload className="mr-2 h-4 w-4" />{uploading === a.id ? "Uploading…" : "Confirm delivery + proof"}</span>
                      </Button>
                    </label>
                  )}
                  {a.status === "picked_up" && (
                    <Button variant="outline" onClick={() => onDeliver(a.id, null)}>Confirm without proof</Button>
                  )}
                  {a.status === "delivered" && (
                    <span className="text-sm text-sage-deep">✓ Delivered {a.delivered_at ? format(new Date(a.delivered_at), "PP p") : ""}</span>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
