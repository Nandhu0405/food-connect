import { Link, useNavigate } from "@tanstack/react-router";
import { Leaf, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsBell } from "@/components/NotificationsBell";

export function Navbar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="font-serif text-xl">Food Rescue Network</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm lg:flex">
          <Link to="/" className="text-muted-foreground transition hover:text-foreground">Home</Link>
          {user && (
            <>
              <Link to="/dashboard" className="text-muted-foreground transition hover:text-foreground">Dashboard</Link>
              <Link to="/donations" className="text-muted-foreground transition hover:text-foreground">Browse</Link>
              <Link to="/analytics" className="text-muted-foreground transition hover:text-foreground">Analytics</Link>
              {role === "donor" && (
                <Link to="/donations/new" className="text-muted-foreground transition hover:text-foreground">Post</Link>
              )}
              {role === "volunteer" && (
                <Link to="/volunteers/my" className="text-muted-foreground transition hover:text-foreground">My pickups</Link>
              )}
              {role === "admin" && (
                <Link to="/admin/volunteers" className="text-muted-foreground transition hover:text-foreground">Approvals</Link>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && <NotificationsBell />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.email?.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.email}</div>
                  <div className="text-xs capitalize text-muted-foreground">{role ?? "member"}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>Dashboard</DropdownMenuItem>
                {role === "volunteer" ? (
                  <DropdownMenuItem onClick={() => navigate({ to: "/volunteers/my" })}>My pickups</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate({ to: "/volunteers/apply" })}>Become a volunteer</DropdownMenuItem>
                )}
                {role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin/volunteers" })}>Volunteer approvals</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => navigate({ to: "/auth", search: { mode: "signup" } as never })}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
