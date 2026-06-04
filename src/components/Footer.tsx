import { Leaf } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-secondary/40">
      <div className="container-page flex flex-col gap-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" />
          <span className="font-serif text-base text-foreground">Food Rescue Network</span>
        </div>
        <p>Connecting surplus food with people who need it. Built with care.</p>
        <p>© {new Date().getFullYear()} Food Rescue Network</p>
      </div>
    </footer>
  );
}
