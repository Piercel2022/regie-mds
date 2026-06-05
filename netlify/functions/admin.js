// ─────────────────────────────────────────────────────────────────────────────
// admin.js
// Méthodes :
//   GET    /.netlify/functions/admin?resource=campaigns
//   POST   /.netlify/functions/admin  { resource, action, data }
//
// Protégé par ADMIN_SECRET (variable d'env Netlify).
// Actions disponibles :
//   campaigns : list | create | update | delete
//   creatives : list | create | update | delete
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

function isAuthorized(event) {
  const auth = event.headers["authorization"] || "";
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

// ── Handlers par ressource ─────────────────────────────────────────────────

async function handleCampaigns(action, data) {
  switch (action) {
    case "list": {
      const { data: rows, error } = await supabase
        .from("campaigns")
        .select(`
          id, name, status, placement,
          start_date, end_date, budget_eur, created_at,
          advertiser:advertisers(name, email)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return rows;
    }
    case "create": {
      const { data: row, error } = await supabase
        .from("campaigns")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    case "update": {
      const { id, ...fields } = data;
      const { data: row, error } = await supabase
        .from("campaigns")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    case "delete": {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", data.id);
      if (error) throw error;
      return { deleted: true };
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function handleCreatives(action, data) {
  switch (action) {
    case "list": {
      const { data: rows, error } = await supabase
        .from("creatives")
        .select("*, campaign:campaigns(name)")
        .eq("campaign_id", data.campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return rows;
    }
    case "create": {
      const { data: row, error } = await supabase
        .from("creatives")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    case "update": {
      const { id, ...fields } = data;
      const { data: row, error } = await supabase
        .from("creatives")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    case "delete": {
      const { error } = await supabase
        .from("creatives")
        .delete()
        .eq("id", data.id);
      if (error) throw error;
      return { deleted: true };
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ── Handler principal ──────────────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (!isAuthorized(event)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "unauthorized" }) };
  }

  try {
    // GET : liste simple
    if (event.httpMethod === "GET") {
      const resource = event.queryStringParameters?.resource || "campaigns";
      const data = resource === "campaigns"
        ? await handleCampaigns("list", {})
        : await handleCreatives("list", { campaignId: event.queryStringParameters?.campaignId });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // POST : action CRUD
    if (event.httpMethod === "POST") {
      const { resource, action, data } = JSON.parse(event.body || "{}");
      if (!resource || !action) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "missing resource or action" }) };
      }
      const result = resource === "campaigns"
        ? await handleCampaigns(action, data || {})
        : await handleCreatives(action, data || {});
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "method_not_allowed" }) };
  } catch (err) {
    console.error("admin error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};