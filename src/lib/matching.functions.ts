import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface Match {
  ngo_id: string;
  name: string;
  city: string | null;
  score: number;
  breakdown: { distance: number; foodType: number; quantity: number; capacity: number; urgency: number; expiry: number };
  reason: string;
}

function haversineKm(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Weights (sum = 100)
const W = { distance: 30, foodType: 15, quantity: 15, capacity: 10, urgency: 20, expiry: 10 };

export const suggestNgoMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ donationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ matches: Match[] }> => {
    const { supabase } = context;

    const { data: donation, error: dErr } = await supabase
      .from("donations").select("*").eq("id", data.donationId).single();
    if (dErr || !donation) throw new Error("Donation not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ngoRoles } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "ngo");
    const ngoIds = (ngoRoles ?? []).map((r) => r.user_id);
    if (ngoIds.length === 0) return { matches: [] };

    const { data: ngos } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, org_name, city, address, latitude, longitude")
      .in("id", ngoIds);

    // NGO activity (load count of accepted/completed in last 30 days as capacity proxy)
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: activity } = await supabaseAdmin
      .from("donations")
      .select("claimed_by")
      .gte("created_at", since)
      .not("claimed_by", "is", null);
    const loadByNgo = new Map<string, number>();
    (activity ?? []).forEach((r) => loadByNgo.set(r.claimed_by!, (loadByNgo.get(r.claimed_by!) ?? 0) + 1));

    const now = Date.now();
    const expiresIn = Math.max(0, new Date(donation.expires_at).getTime() - now) / 3_600_000; // hours
    const pickupWindow = Math.max(0, new Date(donation.pickup_to).getTime() - now) / 3_600_000;
    const foodType = (donation.food_type || "").toLowerCase();

    const candidates = (ngos ?? []).map((n) => {
      // Distance
      let distScore = 0;
      const km = haversineKm(donation.latitude, donation.longitude, n.latitude, n.longitude);
      if (km != null) {
        // 0km -> 100, 30km+ -> 0
        distScore = Math.max(0, 100 - (km / 30) * 100);
      } else if (n.city && donation.city && n.city.toLowerCase() === donation.city.toLowerCase()) {
        distScore = 80;
      } else if (n.city || donation.city) {
        distScore = 30;
      }

      // Food type compatibility (no NGO preferences stored — use neutral score boosted if NGO name hints)
      const orgText = (n.org_name || n.display_name || "").toLowerCase();
      let foodScore = 60;
      if (foodType.includes("veg") && (orgText.includes("vegan") || orgText.includes("veg"))) foodScore = 95;
      if (foodType.includes("meat") && orgText.includes("vegan")) foodScore = 10;
      if (foodType.includes("baker") || foodType.includes("bread")) foodScore = Math.max(foodScore, 70);

      // Quantity fit (assume mid-sized NGOs handle 5-200 servings well)
      const qty = Number(donation.quantity) || 0;
      const quantityScore = qty <= 0 ? 50 : qty < 5 ? 60 : qty <= 200 ? 90 : qty <= 500 ? 65 : 40;

      // Capacity: fewer current claims = more capacity available
      const load = loadByNgo.get(n.id) ?? 0;
      const capacityScore = Math.max(20, 100 - load * 12);

      // Urgency: shorter pickup window = higher score for nearby/active NGOs
      const urgencyScore = pickupWindow <= 2 ? 95 : pickupWindow <= 6 ? 80 : pickupWindow <= 24 ? 60 : 40;

      // Expiry: shorter = higher
      const expiryScore = expiresIn <= 4 ? 95 : expiresIn <= 12 ? 75 : expiresIn <= 48 ? 55 : 35;

      const total =
        (distScore * W.distance +
          foodScore * W.foodType +
          quantityScore * W.quantity +
          capacityScore * W.capacity +
          urgencyScore * W.urgency +
          expiryScore * W.expiry) /
        100;

      const reasons: string[] = [];
      if (distScore >= 80) reasons.push(km != null ? `~${km.toFixed(1)}km away` : "same city");
      else if (distScore >= 40) reasons.push("nearby region");
      if (foodScore >= 85) reasons.push("strong food-type match");
      if (capacityScore >= 80) reasons.push("low current load");
      if (urgencyScore >= 80) reasons.push("can act on tight pickup window");
      if (expiryScore >= 80) reasons.push("handles soon-to-expire items");
      const reason = reasons.length ? reasons.join(" • ") : "balanced overall fit";

      return {
        ngo_id: n.id,
        name: n.org_name || n.display_name || "NGO",
        city: n.city,
        score: Math.round(total),
        breakdown: {
          distance: Math.round(distScore),
          foodType: Math.round(foodScore),
          quantity: Math.round(quantityScore),
          capacity: Math.round(capacityScore),
          urgency: Math.round(urgencyScore),
          expiry: Math.round(expiryScore),
        },
        reason,
      } satisfies Match;
    });

    candidates.sort((a, b) => b.score - a.score);
    return { matches: candidates.slice(0, 5) };
  });

export const listApprovedVolunteers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: apps } = await supabase
      .from("volunteer_applications")
      .select("user_id, full_name, phone, vehicle_type, city")
      .eq("status", "approved");
    return { volunteers: apps ?? [] };
  });
