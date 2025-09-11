import 'dotenv/config'
import { URL } from 'url'
import nodeFetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

async function fetchJson(url) {
  const res = await nodeFetch(url)
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
      if (hall === 'open-kitchen') hall = 'open-kitchen'
    }
  }

  return { hall, meal, date }
}

function normalizeAllergens(item) {
  // Nutrislice may include allergen data under different keys; attempt to unify
  if (!item) return []
  const a = item.allergens || item.allergen || item.allergenNames || item.allergenList || item.allergen_names
  if (Array.isArray(a)) return a.map(x => (typeof x === 'string' ? x : x.name || x.label)).filter(Boolean)
  return []
}

function collectStationsFromJson(obj) {
  const stations = []

  function extractAllergensFromFood(food) {
    if (!food || typeof food !== 'object') return []
    const candidates = []
    // common places
    if (food.icons && food.icons.food_icons) candidates.push(...food.icons.food_icons)
    if (food.food_icons) candidates.push(...food.food_icons)
    if (food.icons && Array.isArray(food.icons)) candidates.push(...food.icons)
    if (food.icons && food.icons.length === undefined && typeof food.icons === 'object') {
      // sometimes icons is an object with nested arrays
      Object.values(food.icons).forEach(v => { if (Array.isArray(v)) candidates.push(...v) })
    }

    // normalize to strings
    const out = []
    for (const c of candidates) {
      if (!c) continue
      if (typeof c === 'string') out.push(c)
      else if (c.slug) out.push(c.slug)
      else if (c.name) out.push(c.name)
      else if (c.synced_name) out.push(c.synced_name)
      else if (c.label) out.push(c.label)
    }
    return Array.from(new Set(out))
  }

  function parseSequentialMenuArray(arr) {
    const result = []
    let currentStation = { station: 'General', dishes: [] }
    let seenAny = false

    for (const item of arr) {
      if (!item || typeof item !== 'object') continue

  // detect common section-title flags
  const isSectionTitle = item.is_section_title === true || item.isSectionTitle === true || item.is_section === true || item.isSection === true
  // easier checks: if it has a 'text' and no 'food' but flags
  if (isSectionTitle || item.is_section_title) {
        // push previous station if it had dishes
        if (currentStation.dishes.length > 0 || seenAny) result.push(currentStation)
        const stationName = (item.text || item.title || item.sectionTitle || item.name || item.label || item.section_name || item.section_name || '').toString().trim() || 'Section'
        currentStation = { station: stationName, dishes: [] }
        seenAny = true
        continue
      }

      // sometimes section titles are represented as objects with 'is_section_title': false? fallback detect
      const maybeText = item.text || item.title || item.sectionTitle || item.section_name || null
      if (maybeText && !item.food && !item.menuItem && !item.food_item && (item.is_section_title === undefined)) {
        // heuristically treat this as a section header if following items are foods
        // push previous
        if (currentStation.dishes.length > 0 || seenAny) result.push(currentStation)
        currentStation = { station: String(maybeText).trim(), dishes: [] }
        seenAny = true
        continue
      }

      // food entry
      const food = item.food || item.menu || item.menu_item || item.food_item || item.item || item.menuItem || item.menu_item_detail
      if (food || item.name && item.name.toString().length > 0 && (item.id || item.food || item.menuItem)) {
        const f = food || item
        const id = f.id || f.menuItemId || f.menu_item_id || f.masterItemId || f.menu_item_id || f.menu_item_id || null
        const name = f.name || f.title || f.itemName || f.displayName || f.menuItemName || (item.name && String(item.name)) || null
        const allergens = extractAllergensFromFood(f)
        if (name) {
          currentStation.dishes.push({ id: id || null, name: String(name).trim(), allergens })
          seenAny = true
        }
        continue
      }

      // If item contains nested arrays that look like menu entries, try those
      for (const k of Object.keys(item)) {
        const v = item[k]
        if (Array.isArray(v)) {
          const nested = parseSequentialMenuArray(v)
          if (nested && nested.length) {
            // push current station then nested stations
            if (currentStation.dishes.length > 0) result.push(currentStation)
            for (const ns of nested) result.push(ns)
            currentStation = { station: 'General', dishes: [] }
            seenAny = true
            break
          }
        }
      }
    }

    if (currentStation.dishes.length > 0) result.push(currentStation)
    return result
  }

  function walk(node) {
    if (!node) return
    if (Array.isArray(node)) {
      const parsed = parseSequentialMenuArray(node)
      if (parsed && parsed.length) {
        stations.push(...parsed)
      } else {
        node.forEach(walk)
      }
      return
    }
    if (typeof node === 'object') {
      Object.keys(node).forEach(k => {
        const val = node[k]
        if (val && (Array.isArray(val) || typeof val === 'object')) walk(val)
      })
    }
  }

  walk(obj)
  // dedupe stations by name while preserving order
  const seen = new Set()
  return stations.filter(s => {
    const key = String(s.station)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function scrapeMenu(url) {
  if (!url) throw new Error('URL is required')
  const { hall, meal, date } = extractMetaFromApiUrl(url)
  const json = await fetchJson(url)
  // Dump raw JSON for inspection when DEBUG_SCRAPER is set
  if (process.env.DEBUG_SCRAPER) {
    try {
      console.log('RAW_JSON_DUMP_START')
      console.log(JSON.stringify(json, null, 2))
      console.log('RAW_JSON_DUMP_END')
    } catch (e) {
      console.log('Failed to stringify JSON response', e.message)
    }
  }

  const stations = collectStationsFromJson(json)

  // map to required output
  const results = stations.map(s => ({
    hall: hall || null,
    meal: meal || null,
    date: date || null,
    station: s.station,
    dishes: s.dishes
  }))

  return results
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

async function saveToSupabase(data) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    console.log('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set; skipping Supabase upsert')
    return
  }

  // Upsert dishes and insert offers. Use transactions where possible.
  for (const entry of data) {
    const { hall, meal, date, station, dishes } = entry
    for (const dish of dishes) {
      const dishId = dish.id || null
      const name = dish.name || ''
      const name_norm = normalizeName(name)

      try {
        // upsert into dishes table — prefer id and name_raw, but some DBs may not have name_raw
        const upsertPayload = { id: dishId, name_raw: name }
        let { error: upsertError } = await supabase.from('dishes').upsert(upsertPayload, { onConflict: 'id' })

        if (upsertError) {
          // If the schema doesn't have name_raw, try an id-only upsert to satisfy FK constraints on offers
          if (/name_raw|column/i.test(upsertError.message || '')) {
            console.warn(`name_raw column missing, falling back to id-only upsert for dish ${dishId}`)
            const { error: fallbackError } = await supabase.from('dishes').upsert({ id: dishId }, { onConflict: 'id' })
            if (fallbackError) {
              console.error('Failed upserting dish (fallback)', dishId, fallbackError.message)
            } else {
              console.log('Upserted dish (id-only fallback)', dishId)
            }
          } else {
            console.error('Failed upserting dish', dishId, upsertError.message)
          }
        } else {
          console.log('Upserted dish', dishId)
        }

        if (!dishId) continue

        // insert into offers; ensure uniqueness by dish_id, offer_date, meal
        const offerPayload = {
          dish_id: dishId,
          hall,
          station,
          meal,
          offer_date: date
        }

        const { data: existing, error: selectError } = await supabase.from('offers').select('id').match({ dish_id: dishId, offer_date: date, meal }).limit(1)
        if (selectError) {
          console.error('Failed checking existing offer', selectError.message)
        }

        if (existing && existing.length > 0) {
          console.log('Offer already exists for', dishId, date, meal)
        } else {
          const { error: insertError } = await supabase.from('offers').insert(offerPayload)
          if (insertError) console.error('Failed inserting offer', insertError.message)
          else console.log('Inserted offer for', dishId, date, meal)
        }
      } catch (err) {
        console.error('Supabase error for dish', dishId, err.message)
      }
    }
  }
}

export { scrapeMenu }

// If run directly, accept URL(s) from CLI and log JSON
if (process.argv[1] && process.argv[1].endsWith('scraper.js')) {
  (async () => {
    const argv = process.argv.slice(2)
    const testUrls = argv.length ? argv : [
      'https://ubc.api.nutrislice.com/menu/api/weeks/school/ubc-feast-totem-park-residence/menu-type/feast-totem-park-residence-lunch/2025/09/10'
    ]

    for (const u of testUrls) {
      try {
        console.log(`Scraping: ${u}`)
        const data = await scrapeMenu(u)
        console.log(JSON.stringify(data, null, 2))
  // attempt to save to Supabase when run directly
  await saveToSupabase(data)
      } catch (err) {
        console.error('Error scraping', u, err.message)
      }
    }
  })()
}
