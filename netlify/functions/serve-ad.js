// ─────────────────────────────────────────────────────────────────────────────
// serve-ad.js
// GET /.netlify/functions/serve-ad?placement=newsletter
//
// Renvoie le créatif actif pour le placement demandé.
// Utilisé par ad.js côté client.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const placement = event.queryStringParameters?.placement || "default";
  const today     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // 1. Trouver la campagne active pour ce placement
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("status", "active")
      .eq("placement", placement)
      .lte("start_date", today)
      .gte("end_date",   today)
      .limit(1)
      .maybeSingle();

    if (campErr) throw campErr;
    if (!campaign) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ad: null }),
      };
    }

    // 2. Récupérer le créatif actif de cette campagne
    const { data: creative, error: creErr } = await supabase
      .from("creatives")
      .select("id, image_url, click_url, alt_text")
      .eq("campaign_id", campaign.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (creErr) throw creErr;
    if (!creative) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ad: null }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ad: {
          id:          creative.id,
          campaignId:  campaign.id,
          imageUrl:    creative.image_url,
          clickUrl:    creative.click_url,
          altText:     creative.alt_text || "Publicité",
          placement,
        },
      }),
    };
  } catch (err) {
    console.error("serve-ad error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "internal_error" }),
    };
  }
};