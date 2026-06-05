import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications.functions";

interface NotifRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as NotifRow[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as NotifRow;
          toast(n.title, { description: n.body ?? undefined });
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  if (!user) return null;
  const unread = (data ?? []).filter((n) => !n.read).length;

  const onClick = async (n: NotifRow) => {
    if (!n.read) {
      try { await markRead({ data: { id: n.id } }); } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link });
  };

  const onClear = async () => {
    try { await markAll(); } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">
              {unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-medium">Notifications</div>
          {unread > 0 && (
            <button onClick={onClear} className="text-xs text-primary hover:underline">Mark all read</button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            (data ?? []).map((n) => (
              <button
                key={n.id}
                onClick={() => onClick(n)}
                className={`block w-full border-b px-3 py-3 text-left transition hover:bg-muted/60 ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.body && <div className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</div>}
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
