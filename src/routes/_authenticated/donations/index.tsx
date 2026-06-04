import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DonationCard, type DonationRow } from "@/components/DonationCard";

export const Route = createFileRoute("/_authenticated/donations/")({
  head: () => ({ meta: [{ title: "Browse rescues — Food Rescue Network" }] }),
  component: BrowseDonations,
});

function BrowseDonations() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("available");

  const { data, refetch } = useQuery({
    queryKey: ["donations", status],
    queryFn: async () => {
      let query = supabase.from("donations").select("*").order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status as "available" | "claimed" | "picked_up" | "completed" | "expired" | "cancelled");
      const { data } = await query;
      return (data ?? []) as DonationRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("donations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const filtered = (data ?? []).filter((d) => {
    if (!q) return true;
    const term = q.toLowerCase();
    return (
      d.title.toLowerCase().includes(term) ||
      d.food_type.toLowerCase().includes(term) ||
      (d.city ?? "").toLowerCase().includes(term) ||
      d.pickup_address.toLowerCase().includes(term)
    );
  });

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.18em] text-sage-deep">Browse</p>
        <h1 className="font-serif text-4xl sm:text-5xl">Active rescues</h1>
        <p className="text-muted-foreground">Find food waiting to be picked up by an NGO or volunteer.</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by food, city or address…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
            <SelectItem value="picked_up">Picked up</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => <DonationCard key={d.id} d={d} />)}
        </div>
      ) : (
        <Card className="mt-8 border-dashed bg-secondary/40 p-12 text-center text-muted-foreground">
          No rescues match your filters yet.
        </Card>
      )}
    </div>
  );
}
