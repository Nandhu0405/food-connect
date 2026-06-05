import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const applyAsVolunteer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        full_name: z.string().min(2).max(120),
        phone: z.string().min(5).max(40),
        vehicle_type: z.enum(["bike", "scooter", "car", "van", "truck", "walking"]),
        license_number: z.string().max(60).optional().nullable(),
        city: z.string().max(80).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("volunteer_applications")
      .upsert({
        user_id: userId,
        full_name: data.full_name,
        phone: data.phone,
        vehicle_type: data.vehicle_type,
        license_number: data.license_number ?? null,
        city: data.city ?? null,
        status: "pending",
      }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewVolunteer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ensure admin
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!(roles ?? []).some((r) => r.role === "admin")) throw new Error("Not authorized");

    const { data: app, error } = await supabase
      .from("volunteer_applications")
      .update({
        status: data.decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        notes: data.notes ?? null,
      })
      .eq("id", data.id)
      .select("user_id")
      .single();
    if (error) throw new Error(error.message);

    // If approved, ensure they have 'volunteer' role
    if (data.decision === "approved") {
      const mod = await import("@/integrations/supabase/client.server");
      await mod.supabaseAdmin.from("user_roles").upsert(
        { user_id: app.user_id, role: "volunteer" },
        { onConflict: "user_id,role" },
      );
      await mod.supabaseAdmin.from("notifications").insert({
        user_id: app.user_id,
        type: "volunteer_approved",
        title: "You're approved!",
        body: "Welcome aboard — you can now accept pickup assignments.",
        link: "/volunteers/my",
      });
    } else {
      const mod = await import("@/integrations/supabase/client.server");
      await mod.supabaseAdmin.from("notifications").insert({
        user_id: app.user_id,
        type: "volunteer_rejected",
        title: "Application update",
        body: data.notes || "Your volunteer application was not approved.",
        link: "/volunteers/apply",
      });
    }
    return { ok: true };
  });
