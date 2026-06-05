// ─────────────────────────────────────────────────────────────────────────────
// track.js
// POST /.netlify/functions/track
// Body JSON : { campaignId, creativeId, eventType, placement, pageUrl }
//
// eventType = "impression" | "click"
// Pour click : renvoie 302 vers clickUrl (redirect transparent).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import crypto           from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY   // service key pour écriture
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function hashIp(ip) {
  // Hash SHA-256 de l'IP → conformité RGPD (pas de donnée perso en clair)
  return crypto.createHash("sha256").update(ip || "").digest("hex");
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "invalid_json" }) };
  }

  const { campaignId, creativeId, eventType, placement, pageUrl, clickUrl } = body;

  if (!campaignId || !eventType) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing_fields" }) };
  }

  // IP de l'utilisateur (Netlify expose x-forwarded-for)
  const rawIp = event.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "";
  const ipHash = hashIp(rawIp);

  try {
    const { error } = await supabase.from("events").insert({
      campaign_id: campaignId,
      creative_id: creativeId || null,
      event_type:  eventType,
      placement:   placement  || null,
      page_url:    pageUrl    || null,
      ip_hash:     ipHash,
      user_agent:  event.headers["user-agent"] || null,
    });

    if (error) throw error;

    // Pour un clic : redirect 302 vers la destination
    if (eventType === "click" && clickUrl) {
      return {
        statusCode: 302,
        headers: { ...CORS, Location: clickUrl },
        body: "",
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("track error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "internal_error" }),
    };
  }
};