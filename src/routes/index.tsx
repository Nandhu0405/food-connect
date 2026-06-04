import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HeartHandshake, MapPin, Sparkles, Truck, Users, Utensils } from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Food Rescue Network — Rescue surplus food, feed your community" },
      {
        name: "description",
        content:
          "A real-time network connecting restaurants, households and events with verified NGOs to turn surplus food into served meals.",
      },
      { property: "og:title", content: "Food Rescue Network" },
      {
        property: "og:description",
        content: "Rescue surplus food. Feed your community.",
      },
    ],
  }),
  component: Landing,
});

const stats = [
  { k: "1.3B+", v: "tons of food wasted globally each year" },
  { k: "828M", v: "people facing hunger today" },
  { k: "<2h", v: "median pickup time on our network" },
];

const features = [
  {
    icon: Utensils,
    title: "Post surplus in seconds",
    body: "Snap a photo, set a pickup window, and your post goes live to nearby verified NGOs.",
  },
  {
    icon: MapPin,
    title: "Smart matching",
    body: "We surface the closest NGOs with capacity, so meals reach people fast — before food spoils.",
  },
  {
    icon: Truck,
    title: "Pickup, tracked end-to-end",
    body: "Real-time status updates from claim to delivery, with full history for both sides.",
  },
  {
    icon: HeartHandshake,
    title: "Volunteer network",
    body: "Volunteer drivers can opt-in to bridge the last mile when an NGO can't pick up directly.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-12 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-24">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-sage-deep/30 bg-sage/20 px-3 py-1 text-xs font-medium text-sage-deep">
              <Sparkles className="h-3.5 w-3.5" />
              A kinder default for surplus food
            </span>
            <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Rescue surplus food.
              <br />
              <span className="italic text-sage-deep">Feed your community.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Food Rescue Network connects restaurants, households, events and corporates
              with verified NGOs, shelters and community kitchens — in real time, with
              dignity, before a single plate goes to waste.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/auth" search={{ mode: "signup" } as never}>
                  Join the network <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link to="/donations">Browse rescues</Link>
              </Button>
            </div>
            <dl className="grid grid-cols-3 gap-6 border-t border-border/60 pt-8">
              {stats.map((s) => (
                <div key={s.k}>
                  <dt className="font-serif text-2xl text-foreground sm:text-3xl">{s.k}</dt>
                  <dd className="mt-1 text-xs leading-snug text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-sage/40 via-accent to-clay/20 blur-2xl" />
            <div className="overflow-hidden rounded-3xl border border-border/60 shadow-xl">
              <img
                src={heroFood}
                alt="Fresh vegetables and bread arranged on a cream linen surface"
                width={1600}
                height={1200}
                className="h-full w-full object-cover"
              />
            </div>
            <Card className="absolute -bottom-6 -left-6 hidden w-64 border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur sm:block">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-serif text-lg leading-none">312 meals</div>
                  <div className="text-xs text-muted-foreground">rescued this week nearby</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-border/60 bg-secondary/40 py-20 lg:py-28">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.18em] text-sage-deep">How it works</p>
            <h2 className="mt-3 font-serif text-4xl sm:text-5xl">
              A simple flow between people with food, and people who need it.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title} className="border-border/70 bg-card p-6">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-serif text-xl">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container-page">
          <Card className="overflow-hidden border-sage-deep/30 bg-gradient-to-br from-sage/40 via-cream to-accent p-10 text-center sm:p-16">
            <h2 className="mx-auto max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
              Every meal rescued is a small act of repair.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Whether you have one tray to give or a thousand to receive — there's a place for you here.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to="/auth" search={{ mode: "signup" } as never}>I have food to donate</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-sage-deep/40 px-6">
                <Link to="/auth" search={{ mode: "signup" } as never}>I represent an NGO</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
