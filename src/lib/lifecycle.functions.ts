import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE = process.env.SITE_URL ?? "";

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  link: string,
) {
  const admin = await getAdmin();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link });
}

async function getEmail(userId: string): Promise<string | null> {
  const admin = await getAdmin();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

async function fireEmail(userId: string, makeTpl: (url: string) => { subject: string; html: string }) {
  const email = await getEmail(userId);
  if (!email) return;
  const { sendEmail } = await import("./emails.server");
  const tpl = makeTpl(SITE);
  await sendEmail(email, tpl.subject, tpl.html);
}

// === Donor creates donation -> confirm to donor ===
export const onDonationCreated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ donationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: don } = await supabase.from("donations").select("title, donor_id").eq("id", data.donationId).single();
    if (!don) return { ok: false };
    const link = `/donations/${data.donationId}`;
    await notify(don.donor_id, "donation_created", "Donation posted", `"${don.title}" is now live for NGOs.`, link);
    const { templates } = await import("./emails.server");
    await fireEmail(don.donor_id, (s) => templates.donationCreated(don.title, `${s}${link}`));
    return { ok: true, by: userId };
  });

// === NGO accepts donation ===
export const acceptDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ donationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: e1 } = await supabase
      .from("donations")
      .update({ status: "claimed", claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("id", data.donationId);
    if (e1) throw new Error(e1.message);
    await supabase.from("donation_claims").insert({ donation_id: data.donationId, ngo_id: userId });

    const { data: don } = await supabase.from("donations").select("title, donor_id").eq("id", data.donationId).single();
    const { data: ngo } = await supabase.from("profiles").select("display_name, org_name").eq("id", userId).single();
    if (don) {
      const ngoName = ngo?.org_name || ngo?.display_name || "An NGO";
      const link = `/donations/${data.donationId}`;
      await notify(don.donor_id, "donation_accepted", "Donation accepted", `${ngoName} accepted "${don.title}".`, link);
      const { templates } = await import("./emails.server");
      await fireEmail(don.donor_id, (s) => templates.ngoAccepted(don.title, ngoName, `${s}${link}`));
    }
    return { ok: true };
  });

// === NGO assigns volunteer ===
export const assignVolunteer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ donationId: z.string().uuid(), volunteerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("assignments").insert({
      donation_id: data.donationId,
      volunteer_id: data.volunteerId,
      assigned_by: userId,
      status: "assigned",
    });
    if (error) throw new Error(error.message);
    await supabase.from("donations").update({ status: "assigned" }).eq("id", data.donationId);

    const { data: don } = await supabase.from("donations").select("title, donor_id").eq("id", data.donationId).single();
    if (don) {
      const link = `/volunteers/my`;
      await notify(data.volunteerId, "volunteer_assigned", "New pickup assigned", `"${don.title}" is ready for pickup.`, link);
      await notify(don.donor_id, "volunteer_assigned", "Volunteer assigned", `A volunteer was assigned to "${don.title}".`, `/donations/${data.donationId}`);
      const { templates } = await import("./emails.server");
      await fireEmail(data.volunteerId, (s) => templates.volunteerAssigned(don.title, `${s}${link}`));
    }
    return { ok: true };
  });

// === Volunteer confirms pickup ===
export const confirmPickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assignmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: a, error } = await supabase
      .from("assignments")
      .update({ status: "picked_up", picked_up_at: new Date().toISOString() })
      .eq("id", data.assignmentId)
      .eq("volunteer_id", userId)
      .select("donation_id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("donations").update({ status: "picked_up" }).eq("id", a.donation_id);

    const { data: don } = await supabase.from("donations").select("title, donor_id, claimed_by").eq("id", a.donation_id).single();
    if (don) {
      const link = `/donations/${a.donation_id}`;
      await notify(don.donor_id, "pickup_confirmed", "Pickup confirmed", `"${don.title}" has been picked up.`, link);
      if (don.claimed_by) await notify(don.claimed_by, "pickup_confirmed", "Pickup confirmed", `"${don.title}" is on its way.`, link);
      const { templates } = await import("./emails.server");
      await fireEmail(don.donor_id, (s) => templates.pickupConfirmed(don.title, `${s}${link}`));
    }
    return { ok: true };
  });

// === Volunteer confirms delivery with proof ===
export const confirmDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ assignmentId: z.string().uuid(), proofPath: z.string().min(1).max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: a, error } = await supabase
      .from("assignments")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        proof_url: data.proofPath ?? null,
      })
      .eq("id", data.assignmentId)
      .eq("volunteer_id", userId)
      .select("donation_id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("donations").update({ status: "completed" }).eq("id", a.donation_id);

    const { data: don } = await supabase.from("donations").select("title, donor_id, claimed_by").eq("id", a.donation_id).single();
    if (don) {
      const link = `/donations/${a.donation_id}`;
      await notify(don.donor_id, "delivered", "Delivered!", `"${don.title}" has been delivered. Thank you.`, link);
      if (don.claimed_by) await notify(don.claimed_by, "delivered", "Delivered!", `"${don.title}" has been delivered.`, link);
      const { templates } = await import("./emails.server");
      await fireEmail(don.donor_id, (s) => templates.deliveryCompleted(don.title, `${s}${link}`));
    }
    return { ok: true };
  });
