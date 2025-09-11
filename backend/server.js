import dotenv from 'dotenv'
import { resolve } from 'path'
import express from 'express'
import cors from 'cors'

const _envLoad = dotenv.config({ path: resolve(process.cwd(), '.env') })
if (_envLoad.error) {
  console.warn('dotenv: failed to load .env from project root:', _envLoad.error.message)
}
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(express.json())
app.use(cors())

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function ensureClient(res) {
  const supabase = getSupabase()
  if (!supabase) {
    res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' })
    return null
  }
  return supabase
}

// Helper: compute avg/count for ratings rows per dish
function computeStats(rows) {
  const stats = {}
  for (const r of rows) {
    const id = r.dish_id
    if (!stats[id]) stats[id] = { sum: 0, count: 0 }
    stats[id].sum += Number(r.rating || 0)
    stats[id].count += 1
  }
  const out = {}
  for (const id of Object.keys(stats)) {
    const s = stats[id]
    out[id] = { avg: s.count ? s.sum / s.count : null, count: s.count }
  }
  return out
}

// GET /api/halls?meal=&date=
// Returns average rating per hall for given meal and date
app.get('/api/halls', async (req, res) => {
  const { meal, date: dateQuery } = req.query
  if (!meal) return res.status(400).json({ error: 'meal is required' })
  const date = dateQuery || new Date().toISOString().slice(0,10)

  const supabase = ensureClient(res)
  if (!supabase) return

  try {
    // fetch offers for meal+date
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('hall,dish_id')
      .eq('meal', meal)
      .eq('offer_date', date)

    if (offersError) return res.status(500).json({ error: offersError.message })

    // group dish_ids by hall
    const hallsMap = {}
    const allDishIds = new Set()
    for (const o of offers || []) {
      const hall = o.hall || 'unknown'
      if (!hallsMap[hall]) hallsMap[hall] = new Set()
      if (o.dish_id) {
        hallsMap[hall].add(o.dish_id)
        allDishIds.add(o.dish_id)
      }
    }

    const dishIds = Array.from(allDishIds)
    let ratings = []
    if (dishIds.length > 0) {
      const { data: ratingRows, error: ratingError } = await supabase
        .from('ratings')
        .select('dish_id,rating')
        .in('dish_id', dishIds)
        .eq('meal', meal)
        .eq('offer_date', date)
      if (ratingError) return res.status(500).json({ error: ratingError.message })
      ratings = ratingRows || []
    }

    // compute per-dish stats
    const perDish = computeStats(ratings)

    // compute per-hall aggregate
    const result = []
    for (const [hall, idSet] of Object.entries(hallsMap)) {
      let sum = 0, count = 0
      for (const id of Array.from(idSet)) {
        const s = perDish[id]
        if (s && s.count > 0) {
          sum += s.avg * s.count
          count += s.count
        }
      }
      const avg = count ? sum / count : null
      result.push({ hall, avg, rating_count: count })
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/dishes?hall=&meal=&date=
// Returns stations + dishes for that hall/meal/date with avg rating and count
app.get('/api/dishes', async (req, res) => {
  const { hall, meal, date: dateQuery } = req.query
  if (!hall || !meal) return res.status(400).json({ error: 'hall and meal are required' })
  const date = dateQuery || new Date().toISOString().slice(0,10)

  const supabase = ensureClient(res)
  if (!supabase) return

  try {
    // fetch offers for this hall/meal/date
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('dish_id,station')
      .eq('hall', hall)
      .eq('meal', meal)
      .eq('offer_date', date)

    if (offersError) return res.status(500).json({ error: offersError.message })

    const dishIds = Array.from(new Set((offers || []).map(o => o.dish_id).filter(Boolean)))

    // fetch dish details (use name_raw)
    let dishesMap = {}
    if (dishIds.length > 0) {
      const { data: dishRows, error: dishError } = await supabase
        .from('dishes')
        .select('id,name_raw')
        .in('id', dishIds)
      if (dishError) return res.status(500).json({ error: dishError.message })
      dishesMap = (dishRows || []).reduce((acc, d) => { acc[d.id] = d; return acc }, {})
    }

    // fetch ratings for these dishIds
    const { data: ratingRows, error: ratingError } = await supabase
      .from('ratings')
      .select('dish_id,rating')
      .in('dish_id', dishIds)
      .eq('meal', meal)
      .eq('offer_date', date)
    if (ratingError) return res.status(500).json({ error: ratingError.message })

    const perDish = computeStats(ratingRows || [])

    // group offers by station
    const stationsMap = {}
    for (const o of offers || []) {
      const station = o.station || 'General'
      if (!stationsMap[station]) stationsMap[station] = []
  const d = dishesMap[o.dish_id] || { id: o.dish_id, name_raw: null }
  const stats = perDish[o.dish_id] || { avg: null, count: 0 }
  const avgRounded = (stats.avg !== null && typeof stats.avg === 'number') ? Number(stats.avg.toFixed(2)) : null
  stationsMap[station].push({ id: d.id, name: d.name_raw || null, avg_rating: avgRounded, num_ratings: stats.count })
    }

    const result = Object.keys(stationsMap).map(st => ({ station: st, dishes: stationsMap[st] }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rate
// Body: { dish_id, meal, date, rating }
app.post('/api/rate', async (req, res) => {
  const { dish_id, meal, date: dateFromBody, offer_date: offerDateFromBody, rating } = req.body || {}
  const offer_date = offerDateFromBody || dateFromBody
  const r = Number(rating)
  if (!dish_id || !meal || !offer_date || !Number.isFinite(r)) return res.status(400).json({ error: 'dish_id, meal, offer_date, and numeric rating are required' })
  if (r < 1 || r > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' })

  const supabase = ensureClient(res)
  if (!supabase) return

  try {
    const { error } = await supabase.from('ratings').insert([{ dish_id, meal, offer_date, rating: r }])
    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ...existing routes...

const PORT = process.env.PORT || 4000
if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NODE_ENV !== 'development') {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is set and NODE_ENV is not development — ensure this is intended')
}
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
