// ─────────────────────────────────────────────────────────────────────────────
// dashboard-api.js
// GET /.netlify/functions/dashboard-api?campaignId=xxx
//
// Renvoie les stats agrégées d'une campagne :
// impressions, clics, CTR, courbe journalière (30 derniers jours).
//
// Protégé par un token secret passé en header Authorization.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Content-Type": "application/json",
};

// Auth simple par token partagé (suffisant pour MVP)
function isAuthorized(event) {
  const auth = event.headers["authorization"] || "";
  return auth === `Bearer ${process.env.DASHBOARD_SECRET}`;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (!isAuthorized(event)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  const campaignId = event.queryStringParameters?.campaignId;
  if (!campaignId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing campaignId" }) };
  }

  try {
    // ── 1. Totaux impressions + clics ──────────────────────────────────────
    const { data: totals, error: totErr } = await supabase
      .from("events")
      .select("event_type")
      .eq("campaign_id", campaignId);

    if (totErr) throw totErr;

    const impressions = totals.filter(e => e.event_type === "impression").length;
    const clicks      = totals.filter(e => e.event_type === "click").length;
    const ctr         = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";

    // ── 2. Courbe journalière (30 derniers jours) ──────────────────────────
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const { data: daily, error: dailyErr } = await supabase
      .from("events")
      .select("event_type, created_at")
      .eq("campaign_id", campaignId)
      .gte("created_at", since30.toISOString())
      .order("created_at", { ascending: true });

    if (dailyErr) throw dailyErr;

    // Agrégation par jour côté JS (évite une vue SQL au niveau MVP)
    const byDay = {};
    for (const ev of daily) {
      const day = ev.created_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { impressions: 0, clicks: 0 };
      if (ev.event_type === "impression") byDay[day].impressions++;
      if (ev.event_type === "click")      byDay[day].clicks++;
    }

    const dailyChart = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // ── 3. Info campagne ───────────────────────────────────────────────────
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("name, status, placement, start_date, end_date, budget_eur")
      .eq("id", campaignId)
      .single();

    if (campErr) throw campErr;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        campaign,
        stats: { impressions, clicks, ctr: parseFloat(ctr) },
        daily: dailyChart,
      }),
    };
  } catch (err) {
    console.error("dashboard-api error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "internal_error" }),
    };
  }
};