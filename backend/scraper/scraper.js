// backend/scraper/scraper.js
import 'dotenv/config'
import { URL } from 'url'
import nodeFetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

/** @typedef {'feast'|'gather'|'open-kitchen'} Hall */
/** @typedef {'breakfast'|'lunch'|'dinner'} Meal */
/** @typedef {{ id: number|null, name: string, allergens: string[] }} Dish */
/** @typedef {{ station: string, dishes: Dish[] }} Station */
/** @typedef {{ hall: Hall, meal: Meal, date: string, station: string, dishes: Dish[] }} StationBlock */
/** @typedef {{ dish_id: number, hall: Hall, station: string, meal: Meal, offer_date: string }} OfferRow */

async function fetchJson(url) {
  const res = await nodeFetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

function extractMetaFromApiUrl(inputUrl) {
  const urlObj = new URL(inputUrl)
  const parts = urlObj.pathname.split('/').filter(Boolean)

  // Expecting .../menu/api/weeks/.../menu-type/<menu-type>/<YYYY>/<MM>/<DD>
  let date = null
  const last = parts.slice(-3)
  if (last.length === 3 && /^\d{4}$/.test(last[0]) && /^\d{1,2}$/.test(last[1]) && /^\d{1,2}$/.test(last[2])) {
    const yyyy = last[0]
    const mm = last[1].padStart(2, '0')
    const dd = last[2].padStart(2, '0')
    date = `${yyyy}-${mm}-${dd}`
  } else {
    // fallback: look for YYYY-MM-DD
    const maybe = parts[parts.length - 1]
    if (/^\d{4}-\d{2}-\d{2}$/.test(maybe)) date = maybe
  }

  // meal -> find breakfast|lunch|dinner in parts
  const mealPart = parts.find(p => /(breakfast|lunch|dinner)/i.test(p)) || ''
  const mealMatch = mealPart.match(/(breakfast|lunch|dinner)/i)
  const meal = mealMatch ? mealMatch[1].toLowerCase() : null

  // hall -> look for feast|gather|open-kitchen in parts
  const hallToken = parts.find(p => /(feast|gather|open[-]?kitchen|open)/i.test(p)) || ''
  let hall = null
  if (hallToken) {
    const m = hallToken.match(/(feast|gather|open[-]?kitchen|open)/i)
    if (m) {
      hall = m[1].toLowerCase()
      if (hall === 'open') hall = 'open-kitchen'
    }
  }

  return { hall, meal, date }
}

// ---- station-aware collector (uses days[].menu_info + menu_items[].menu_id) ----
function extractAllergensFromFood(food) {
  if (!food || typeof food !== 'object') return []
  const out = new Set()
  const push = v => {
    if (!v) return
    if (typeof v === 'string') out.add(v)
    else if (v.slug) out.add(v.slug)
    else if (v.name) out.add(v.name)
    else if (v.synced_name) out.add(v.synced_name)
    else if (v.label) out.add(v.label)
  }
  const buckets = [
    food?.icons?.food_icons,
    food?.food_icons,
    Array.isArray(food?.icons) ? food?.icons : undefined,
    ...(food?.icons && typeof food.icons === 'object' && !Array.isArray(food.icons)
      ? Object.values(food.icons)
      : [])
  ].filter(Boolean)
  for (const b of buckets) Array.isArray(b) && b.forEach(push)
  return Array.from(out)
}

function findDay(json, isoDate) {
  const days = Array.isArray(json?.days) ? json.days : []
  // Exact match first
  let day = days.find(d => d?.date === isoDate)
  // Fallback to the first day that has menu_items
  if (!day) day = days.find(d => Array.isArray(d?.menu_items) && d.menu_items.length)
  // Fallback to first day
  if (!day) day = days[0]
  return day || null
}

// ---- replace collectStationsFromJson with this ----
function collectStationsFromJson(json: any): Station[] {
  const stations: Station[] = [];

  // find a day that actually has menu_info + menu_items
  const days = Array.isArray(json?.days) ? json.days : [];
  const day = days.find((d: any) => d?.menu_info && Array.isArray(d?.menu_items));
  if (day?.menu_info && Array.isArray(day?.menu_items)) {
    // Build section_id -> display_name map
    const idToName = new Map<string, string>();
    for (const [sid, info] of Object.entries(day.menu_info)) {
      const name =
        (info as any)?.section_options?.display_name ??
        (info as any)?.display_name ??
        (info as any)?.name ??
        `Section ${sid}`;
      idToName.set(String(sid), String(name));
    }

    // Group dishes by section_id
    const groups = new Map<string, Station>();

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

    for (const item of day.menu_items) {
      // Ignore inline subheaders like "Sides", "Proteins"
      if (item?.is_section_title) continue;

      const food = item?.food || item?.menu_item || item?.menuItem;
      if (!food) continue;

      const sid = String(item?.section_id ?? item?.sectionId ?? "");
      const stationName = idToName.get(sid) ?? "General";

      const group =
        groups.get(stationName) ??
        { station: stationName, dishes: [] as Dish[] };

      const id =
        Number.isFinite(food?.id) ? food.id :
        Number.isFinite(food?.menuItemId) ? food.menuItemId :
        null;

      const name = String(food?.name ?? food?.title ?? "").trim();
      if (!name) continue;

      group.dishes.push({ id, name, allergens: extractFoodAllergens(food) });
      groups.set(stationName, group);
    }

    return Array.from(groups.values());
  }

  // Fallback (rare) — if API doesn’t include menu_info, use your old heuristic:
  return heuristicCollectStations(json);
}

// keep your previous heuristic under a new name so we can fall back
function heuristicCollectStations(obj) {
  // …your previous logic from parseSequentialMenuArray/walk here…
  // (unchanged)
}

async function scrapeMenu(url) {
  if (!url) throw new Error('URL is required')
  const { hall, meal, date } = extractMetaFromApiUrl(url)
  const json = await fetchJson(url)

  if (process.env.DEBUG_SCRAPER) {
    try {
      console.log('RAW_JSON_DUMP_START')
      console.log(JSON.stringify(json, null, 2))
      console.log('RAW_JSON_DUMP_END')
    } catch (e) {
      console.log('Failed to stringify JSON response', e.message)
    }
  }

  const stations = collectStationsFromJsonForDate(json, date)

  return stations.map(s => ({
    hall: hall || null,
    meal: meal || null,
    date: date || null,
    station: s.station,
    dishes: s.dishes
  }))
}

function normalizeName(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim()
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/** @param {StationBlock[]} blocks */
/** @param {StationBlock[]} blocks */
async function saveToSupabase(blocks) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Collect dishes (unique by id) and offers (unique by hall+meal+date+station+dish)
  /** @type {Map<number, string>} */
  const dishMap = new Map();

  /** @typedef {{
    dish_id: number,
    hall: Hall,
    station: string,
    meal: Meal,
    offer_date: string
  }} OfferRow */

  /** @type {Map<string, OfferRow>} */
  const offerMap = new Map();

  for (const b of blocks) {
    const stationName = (b.station || 'General').toString().trim() || 'General';

    for (const d of b.dishes) {
      if (!d.id) continue;

      if (!dishMap.has(d.id)) dishMap.set(d.id, d.name);

      // key now includes station so the same dish can appear at multiple stations
      const key = `${b.hall}|${b.meal}|${b.date}|${stationName}|${d.id}`;
      if (!offerMap.has(key)) {
        offerMap.set(key, {
          dish_id: d.id,
          hall: b.hall,
          station: stationName,
          meal: b.meal,
          offer_date: b.date,
        });
      }
      // If duplicates of the exact same (dish, station) show up, we just ignore them.
    }
  }

  // Upsert dishes
  const dishesPayload = Array.from(dishMap.entries()).map(([id, name_raw]) => ({ id, name_raw }));
  if (dishesPayload.length) {
    const { error } = await supabase
      .from('dishes')
      .upsert(dishesPayload, { onConflict: 'id' });
    if (error) throw new Error(`dishes upsert failed: ${error.message}`);
  }

  // Idempotent upsert of offers using the NEW unique constraint that includes station
  const offersPayload = Array.from(offerMap.values());
  let offersInserted = 0;

  for (let i = 0; i < offersPayload.length; i += 100) {
    const chunk = offersPayload.slice(i, i + 100);
    const { error } = await supabase
      .from('offers')
      .upsert(chunk, { onConflict: 'hall,meal,offer_date,station,dish_id' });
    if (error) throw new Error(`offers upsert failed: ${error.message}`);
    offersInserted += chunk.length;
  }

  return { dishesUpserted: dishesPayload.length, offersInserted };
}

export { scrapeMenu }

// If run directly, accept URL(s) from CLI and log JSON + save to Supabase
if (process.argv[1] && process.argv[1].endsWith('scraper.js')) {
  ;(async () => {
    const argv = process.argv.slice(2)
    const testUrls = argv.length
      ? argv
      : [
          'https://ubc.api.nutrislice.com/menu/api/weeks/school/ubc-feast-totem-park-residence/menu-type/feast-totem-park-residence-lunch/2025/09/10'
        ]

    for (const u of testUrls) {
      try {
        console.log(`Scraping: ${u}`)
        const data = await scrapeMenu(u)
        console.log(JSON.stringify(data, null, 2))
        await saveToSupabase(data)
      } catch (err) {
        console.error('Error scraping', u, err.message)
      }
    }
  })()
}