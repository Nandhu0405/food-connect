import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface Match {
  ngo_id: string;
  name: string;
  city: string | null;
  score: number;
  reason: string;
}

export const suggestNgoMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ donationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ matches: Match[] }> => {
    const { supabase } = context;

    const { data: donation, error: dErr } = await supabase
      .from("donations").select("*").eq("id", data.donationId).single();
    if (dErr || !donation) throw new Error("Donation not found");

    // Fetch NGOs via admin client so we can join roles
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ngoRoles } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "ngo");
    const ngoIds = (ngoRoles ?? []).map((r) => r.user_id);
    if (ngoIds.length === 0) return { matches: [] };

    const { data: ngos } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, org_name, city, address")
      .in("id", ngoIds);

    const candidates = (ngos ?? []).slice(0, 30).map((n) => ({
      id: n.id,
      name: n.org_name || n.display_name || "NGO",
      city: n.city,
      address: n.address,
    }));

    const prompt = `You are matching a surplus food donation to NGO partners.

Donation:
- Title: ${donation.title}
- Food type: ${donation.food_type}
- Quantity: ${donation.quantity} ${donation.unit}
- City: ${donation.city ?? "Unknown"}
- Pickup address: ${donation.pickup_address}
- Pickup window ends: ${donation.pickup_to}

NGO candidates (JSON):
${JSON.stringify(candidates)}

Return the top ${Math.min(5, candidates.length)} NGOs as strict JSON:
{ "matches": [ { "ngo_id": "<id>", "score": 0-100, "reason": "<one short sentence>" } ] }
Rank primarily by city match, then logistical fit. Only valid JSON, no prose.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output only valid minified JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json|```/g, "").trim();
    let parsed: { matches?: Array<{ ngo_id: string; score: number; reason: string }> } = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { matches: [] }; }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const matches: Match[] = (parsed.matches ?? [])
      .map((m) => {
        const c = byId.get(m.ngo_id);
        if (!c) return null;
        return { ngo_id: c.id, name: c.name, city: c.city, score: m.score, reason: m.reason };
      })
      .filter((x): x is Match => x !== null);

    return { matches };
  });
