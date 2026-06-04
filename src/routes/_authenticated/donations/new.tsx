import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/donations/new")({
  head: () => ({ meta: [{ title: "Post a donation — Food Rescue Network" }] }),
  component: NewDonation,
});

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewDonation() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 3600 * 1000);
  const in6h = new Date(now.getTime() + 6 * 3600 * 1000);

  const [form, setForm] = useState({
    title: "",
    description: "",
    food_type: "Cooked meals",
    quantity: 10,
    unit: "servings",
    pickup_address: "",
    city: "",
    pickup_from: isoLocal(now),
    pickup_to: isoLocal(in2h),
    expires_at: isoLocal(in6h),
    image_url: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("donations")
      .insert({
        donor_id: user.id,
        title: form.title,
        description: form.description || null,
        food_type: form.food_type,
        quantity: Number(form.quantity),
        unit: form.unit,
        pickup_address: form.pickup_address,
        city: form.city || null,
        pickup_from: new Date(form.pickup_from).toISOString(),
        pickup_to: new Date(form.pickup_to).toISOString(),
        expires_at: new Date(form.expires_at).toISOString(),
        image_url: form.image_url || null,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Donation posted — nearby NGOs will see it now.");
    navigate({ to: "/donations/$id", params: { id: data!.id } });
  };

  if (role && role !== "donor" && role !== "admin") {
    return (
      <div className="container-page py-16">
        <Card className="p-10 text-center">
          <h2 className="font-serif text-3xl">Only donors can post rescues</h2>
          <p className="mt-2 text-muted-foreground">Your account is registered as <strong>{role}</strong>.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page py-10 lg:py-14">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>
      <div className="mx-auto mt-6 max-w-2xl">
        <h1 className="font-serif text-4xl sm:text-5xl">Post a donation</h1>
        <p className="mt-2 text-muted-foreground">
          Tell NGOs what you have, where to pick it up, and when. The more accurate, the faster it gets rescued.
        </p>

        <Card className="mt-8 p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-5">
            <Field label="Title">
              <Input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 20 boxed lunches from today's event" />
            </Field>
            <Field label="Description">
              <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What's inside? Any allergens, dietary notes…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Food type">
                <Input required value={form.food_type} onChange={(e) => set("food_type", e.target.value)} />
              </Field>
              <Field label="Quantity">
                <Input required type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} />
              </Field>
              <Field label="Unit">
                <Input required value={form.unit} onChange={(e) => set("unit", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <Field label="Pickup address">
                <Input required value={form.pickup_address} onChange={(e) => set("pickup_address", e.target.value)} placeholder="Street, building" />
              </Field>
              <Field label="City">
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Pickup from">
                <Input required type="datetime-local" value={form.pickup_from} onChange={(e) => set("pickup_from", e.target.value)} />
              </Field>
              <Field label="Pickup until">
                <Input required type="datetime-local" value={form.pickup_to} onChange={(e) => set("pickup_to", e.target.value)} />
              </Field>
              <Field label="Food expires at">
                <Input required type="datetime-local" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} />
              </Field>
            </div>
            <Field label="Image URL (optional)">
              <Input value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" />
            </Field>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Posting…" : "Post donation"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
