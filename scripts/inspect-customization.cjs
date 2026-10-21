const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const m = {};
env.split("\n").forEach((l) => {
  const i = l.indexOf("=");
  if (i > 0) m[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
});
const url = m.VITE_SUPABASE_URL || m.SUPABASE_URL;
const key = m.VITE_SUPABASE_ANON_KEY || m.SUPABASE_ANON_KEY;
(async () => {
  const r = await fetch(`${url}/rest/v1/customization?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const j = await r.json();
  const row = Array.isArray(j) ? j[0] : j;
  if (!row) return console.log("no row", JSON.stringify(j));
  const keys = [
    "title", "home_h1", "home_h2", "home_background_type",
    "home_background_value", "logo_url", "card_brand", "card_wordmark", "card_logo_url",
  ];
  for (const k of keys) {
    const v = row[k];
    console.log(k, "=", v === null || v === undefined ? "<null>" : String(v).slice(0, 120));
  }
  console.log("--- all columns ---");
  console.log(Object.keys(row).join(", "));
})();
