import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight, Package, Plus, Sparkles, Truck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DonationCard, type DonationRow } from "@/components/DonationCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Food Rescue Network" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, role } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["recent-donations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);


  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id, role],
    queryFn: async () => {
      const [available, mine, claims] = await Promise.all([
        supabase.from("donations").select("id", { count: "exact", head: true }).eq("status", "available"),
        supabase.from("donations").select("id", { count: "exact", head: true }).eq("donor_id", user!.id),
        supabase.from("donation_claims").select("id", { count: "exact", head: true }).eq("ngo_id", user!.id),
      ]);
      return {
        available: available.count ?? 0,
        mine: mine.count ?? 0,
        claims: claims.count ?? 0,
      };
    },
    enabled: !!user,
  });

  const { data: recent } = useQuery({
    queryKey: ["recent-donations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as DonationRow[];
    },
  });

  const greeting = role === "ngo" ? "Welcome back" : role === "volunteer" ? "Ready to help" : "Welcome back";

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-sage-deep">{greeting}</p>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{user?.email?.split("@")[0]}</h1>
          <p className="mt-2 text-muted-foreground capitalize">Signed in as {role ?? "member"}</p>
        </div>
        {role === "donor" && (
          <Button asChild size="lg">
            <Link to="/donations/new"><Plus className="mr-1 h-4 w-4" /> Post a donation</Link>
          </Button>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Sparkles className="h-5 w-5" />} label="Available rescues now" value={stats?.available ?? "—"} />
        <StatCard icon={<Package className="h-5 w-5" />} label="My donations posted" value={stats?.mine ?? "—"} />
        <StatCard icon={<Truck className="h-5 w-5" />} label="My claimed pickups" value={stats?.claims ?? "—"} />
      </div>

      <div className="mt-14 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-3xl">Latest rescues</h2>
          <p className="text-sm text-muted-foreground">Fresh posts from nearby donors.</p>
        </div>
        <Button variant="ghost" asChild>
          <Link to="/donations">Browse all <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>
      {recent && recent.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((d) => <DonationCard key={d.id} d={d} />)}
        </div>
      ) : (
        <Card className="mt-6 flex flex-col items-center gap-3 border-dashed bg-secondary/40 p-12 text-center">
          <Users className="h-10 w-10 text-sage-deep/60" />
          <h3 className="font-serif text-2xl">No active rescues yet</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Be the first to post surplus food in your community.
          </p>
          {role === "donor" && (
            <Button asChild className="mt-2"><Link to="/donations/new">Post a donation</Link></Button>
          )}
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4 border-border/70 p-5">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-serif text-3xl">{value}</div>
      </div>
    </Card>
  );
}
