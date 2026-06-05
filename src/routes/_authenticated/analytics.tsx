import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, Package, CheckCircle2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Food Rescue Network" }] }),
  component: AnalyticsPage,
});

const COLORS = ["#6f8f6a", "#a8c0a0", "#dce5d4", "#3d5a3a", "#c9a96e", "#b6705a"];

function AnalyticsPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const { data: donations } = await supabase
        .from("donations")
        .select("status, food_type, quantity, created_at, city")
        .order("created_at", { ascending: false })
        .limit(1000);
      return donations ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("analytics-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () =>
        qc.invalidateQueries({ queryKey: ["analytics"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const donations = data ?? [];
  const total = donations.length;
  const completed = donations.filter((d) => d.status === "completed").length;
  const totalQty = donations.reduce((s, d) => s + Number(d.quantity ?? 0), 0);
  const cities = new Set(donations.map((d) => d.city).filter(Boolean)).size;

  // Status breakdown
  const statusCounts = donations.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Top food types
  const typeCounts = donations.reduce<Record<string, number>>((acc, d) => {
    acc[d.food_type] = (acc[d.food_type] ?? 0) + Number(d.quantity ?? 0);
    return acc;
  }, {});
  const typeData = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, qty]) => ({ name, qty }));

  // Donations per day (last 14)
  const dayMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  donations.forEach((d) => {
    const key = new Date(d.created_at).toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  });
  const trendData = Array.from(dayMap, ([date, count]) => ({
    date: date.slice(5),
    count,
  }));

  return (
    <div className="container-page py-10 lg:py-14">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-sage-deep">Insights</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Network analytics</h1>
        <p className="mt-2 text-muted-foreground">Live numbers — updates as donations move through the network.</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Package className="h-5 w-5" />} label="Total donations" value={total} />
        <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Delivered" value={completed} />
        <Stat icon={<Sparkles className="h-5 w-5" />} label="Total quantity" value={totalQty.toFixed(0)} />
        <Stat icon={<Users className="h-5 w-5" />} label="Cities reached" value={cities} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-serif text-2xl">Activity — last 14 days</h3>
          <p className="text-sm text-muted-foreground">New donations posted per day.</p>
          <div className="mt-6 h-64">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="count" stroke={COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-serif text-2xl">Status breakdown</h3>
          <p className="text-sm text-muted-foreground">Where donations are in the rescue journey.</p>
          <div className="mt-6 h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-serif text-2xl">Top food types by quantity</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="qty" radius={[8, 8, 0, 0]} fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
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
