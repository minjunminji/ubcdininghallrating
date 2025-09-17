/// <reference types="deno" />

// supabase/functions/<your-func-name>/index.ts
// Deploy: supabase functions deploy <your-func-name>
// Call examples:
//   POST /functions/v1/<your-func-name>     { "hall":"feast","meal":"breakfast","date":"2025-09-11" }
//   GET  /functions/v1/<your-func-name>?hall=feast&meal=lunch&date=2025-09-11
// Requires: Authorization: Bearer <ANON or SERVICE_ROLE> (Scheduler adds this automatically)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- config ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Nutrislice base
const NS_BASE = "https://ubc.api.nutrislice.com/menu/api/weeks/school";

// Verified per-hall, per-meal endpoints
const ENDPOINTS: Record<
  "feast" | "gather" | "open-kitchen",
  Record<"breakfast" | "lunch" | "dinner", { school: string; menuType: string }>
> = {
  feast: {
    // Feast breakfast has its own slug (no "-breakfast" suffix)
    breakfast: {
      school: "ubc-feast-totem-park-residence",
      menuType: "feast-at-totem-park",
    },
    // Feast lunch & dinner share the same payload
    lunch: {
      school: "ubc-feast-totem-park-residence",
      menuType: "feast-totem-park-residence-lunch",
    },
    dinner: {
      school: "ubc-feast-totem-park-residence",
      menuType: "feast-totem-park-residence-lunch",
    },
  },
  gather: {
    breakfast: {
      school: "ubc-gather-place-vanier-residence",
      menuType: "gather-place-vanier-residence-breakfast",
    },
    // Gather lunch & dinner share the same payload
    lunch: {
      school: "ubc-gather-place-vanier-residence",
      menuType: "gather-place-vanier-residence-lunch",
    },
    dinner: {
      school: "ubc-gather-place-vanier-residence",
      menuType: "gather-place-vanier-residence-lunch",
    },
  },
  "open-kitchen": {
    breakfast: {
      school: "ubc-open-kitchen",
      menuType: "open-kitchen-orchard-commons-residence-breakfast",
    },
    // Open Kitchen lunch & dinner share the same payload
    lunch: {
      school: "ubc-open-kitchen",
      menuType: "open-kitchen-at-orchard-commons",
    },
    dinner: {
      school: "ubc-open-kitchen",
      menuType: "open-kitchen-at-orchard-commons",
    },
  },
};

type Hall = "feast" | "gather" | "open-kitchen";
type Meal = "breakfast" | "lunch" | "dinner";

// ---------- utils ----------
const toISODate = (d = new Date()) => d.toISOString().slice(0, 10); // YYYY-MM-DD
const toPathDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${y}/${m}/${d}`;
};
const buildUrl = (hall: Hall, meal: Meal, isoDate: string) => {
  const { school, menuType } = ENDPOINTS[hall][meal];
  return `${NS_BASE}/${school}/menu-type/${menuType}/${toPathDate(isoDate)}/`;
};

function pickOne<T extends string>(v: string | null, allowed: readonly T[]): T | null {
  if (!v) return null;
  const s = v.trim() as T;
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

async function readSingleParams(req: Request): Promise<{ hall: Hall; meal: Meal; date: string }> {
  const url = new URL(req.url);
  let hall = pickOne<Hall>(url.searchParams.get("hall"), ["feast", "gather", "open-kitchen"]);
  let meal = pickOne<Meal>(url.searchParams.get("meal"), ["breakfast", "lunch", "dinner"]);
  let date = url.searchParams.get("date") || null;

  // Body overrides query if provided
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await req.json();
      if (typeof body.hall === "string") {
        const h = pickOne<Hall>(body.hall, ["feast", "gather", "open-kitchen"]);
        if (h) hall = h;
      }
      if (typeof body.meal === "string") {
        const m = pickOne<Meal>(body.meal, ["breakfast", "lunch", "dinner"]);
        if (m) meal = m;
      }
      if (typeof body.date === "string") date = body.date;
    } catch {
      // ignore
    }
  }

  // Enforce single hall+meal only
  if (!hall || !meal) {
    throw new Error(
      "Provide exactly one hall and one meal. Example body: {\"hall\":\"feast\",\"meal\":\"breakfast\",\"date\":\"YYYY-MM-DD\"}"
    );
  }
  return { hall, meal, date: date || toISODate() };
}

// ---------- scraping ----------
type Dish = { id: number | null; name: string; allergens: string[] };
type Station = { station: string; dishes: Dish[] };
type StationBlock = { hall: Hall; meal: Meal; date: string; station: string; dishes: Dish[] };

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.json();
}

function collectStationsFromJson(json: any): Station[] {
  const stations: Station[] = [];

  const extractFoodAllergens = (food: any) => {
    const out: string[] = [];
    const push = (v: any) => {
      if (!v) return;
      if (typeof v === "string") out.push(v);
      else if (v.slug) out.push(v.slug);
      else if (v.name) out.push(v.name);
      else if (v.synced_name) out.push(v.synced_name);
      else if (v.label) out.push(v.label);
    };
    const buckets = [
      food?.icons?.food_icons,
      food?.food_icons,
      Array.isArray(food?.icons) ? food?.icons : undefined,
      ...(food?.icons && typeof food.icons === "object" && !Array.isArray(food.icons)
        ? Object.values(food.icons)
        : []),
    ].filter(Boolean);
    for (const b of buckets) Array.isArray(b) && b.forEach(push);
    return Array.from(new Set(out));
  };

  const parseArray = (arr: any[]) => {
    let current: Station = { station: "General", dishes: [] };
    let seenAny = false;

    for (const item of arr) {
      if (!item || typeof item !== "object") continue;

      const isHeader =
        item.is_section_title === true ||
        item.isSectionTitle === true ||
        item.is_section === true ||
        item.isSection === true ||
        (item.text && !item.food && item.is_section_title !== false);

      if (isHeader) {
        if (current.dishes.length || seenAny) stations.push(current);
        const label =
          (item.text || item.title || item.sectionTitle || item.name || item.label || item.section_name || "")
            .toString()
            .trim() || "Section";
        current = { station: label, dishes: [] };
        seenAny = true;
        continue;
      }

      const food = item.food || item.menu || item.menu_item || item.item || item.menuItem || item.menu_item_detail;
      if (food || (item.name && (item.id || item.food))) {
        const f = food || item;
        const id = f.id ?? f.menuItemId ?? f.menu_item_id ?? f.masterItemId ?? null;
        const name = (f.name ?? f.title ?? f.itemName ?? f.displayName ?? item.name ?? "").toString().trim();
        if (name) {
          current.dishes.push({
            id: typeof id === "number" ? id : id ? Number(id) : null,
            name,
            allergens: extractFoodAllergens(f),
          });
          seenAny = true;
        }
        continue;
      }

      for (const v of Object.values(item)) {
        if (Array.isArray(v)) parseArray(v);
      }
    }

    if (current.dishes.length) stations.push(current);
  };

  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      const before = stations.length;
      parseArray(node);
      if (stations.length > before) return;
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      Object.values(node).forEach(walk);
    }
  };

  walk(json);

  // De-dupe by station name (keep first)
  const seen = new Set<string>();
  return stations.filter((s) => {
    if (seen.has(s.station)) return false;
    seen.add(s.station);
    return true;
  });
}

async function scrapeMenu(hall: Hall, meal: Meal, isoDate: string): Promise<StationBlock[]> {
  const url = buildUrl(hall, meal, isoDate);
  const json = await fetchJson(url);
  const stations = collectStationsFromJson(json);
  return stations.map((s) => ({ hall, meal, date: isoDate, station: s.station, dishes: s.dishes }));
}

// ---------- DB save ----------
async function saveToSupabase(blocks: StationBlock[]) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Collect unique dishes & offers
  const dishMap = new Map<number, string>();
  type OfferRow = { dish_id: number; hall: Hall; station: string; meal: Meal; offer_date: string };
  const offers: OfferRow[] = [];

  for (const b of blocks) {
    for (const d of b.dishes) {
      if (!d.id) continue;
      if (!dishMap.has(d.id)) dishMap.set(d.id, d.name);
      offers.push({
        dish_id: d.id,
        hall: b.hall,
        station: b.station,
        meal: b.meal,
        offer_date: b.date,
      });
    }
  }

  // Upsert dishes
  const dishesPayload = Array.from(dishMap.entries()).map(([id, name_raw]) => ({ id, name_raw }));
  if (dishesPayload.length) {
    const { error } = await supabase.from("dishes").upsert(dishesPayload, { onConflict: "id" });
    if (error) throw new Error(`dishes upsert failed: ${error.message}`);
  }

  // Insert offers (avoid duplicates per hall/meal/date/dish)
  const dishIds = offers.map((o) => o.dish_id);
  const sample = offers[0];
  const { data: existing, error: selErr } = await supabase
    .from("offers")
    .select("dish_id")
    .eq("hall", sample.hall)
    .eq("meal", sample.meal)
    .eq("offer_date", sample.offer_date)
    .in("dish_id", dishIds);

  if (selErr) throw new Error(`offers select failed: ${selErr.message}`);

  const existingSet = new Set((existing ?? []).map((r: any) => r.dish_id as number));
  const toInsert = offers.filter((r) => !existingSet.has(r.dish_id));

  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    if (!chunk.length) continue;
    const { error: insErr } = await supabase.from("offers").insert(chunk);
    if (insErr) throw new Error(`offers insert failed: ${insErr.message}`);
  }

  return { dishesUpserted: dishesPayload.length, offersInserted: toInsert.length };
}

// ---------- handler (single hall+meal per call) ----------
Deno.serve(async (req) => {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) {
    return new Response(JSON.stringify({ code: 401, message: "Missing authorization header" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { hall, meal, date } = await readSingleParams(req);

    const blocks = await scrapeMenu(hall, meal, date);
    const stations = blocks.length;
    const dishes = blocks.reduce((t, b) => t + b.dishes.length, 0);

    let offersInserted = 0;
    if (blocks.length) {
      const res = await saveToSupabase(blocks);
      offersInserted = res.offersInserted;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date,
        hall,
        meal,
        stations,
        dishes,
        offersInserted,
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
});
