import dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const meal = process.argv[2] || 'lunch'
  const date = process.argv[3] || new Date().toISOString().slice(0,10)
  const hall = process.argv[4] || null

  console.log('Querying offers for', { meal, date, hall })
  let q = supabase.from('offers').select('*').eq('meal', meal).eq('offer_date', date)
  if (hall) q = q.eq('hall', hall)
  const { data: offers, error: offersError } = await q
  if (offersError) console.error('offersError', offersError.message)
  console.log('offers:', offers)

  const dishIds = (offers || []).map(o => o.dish_id).filter(Boolean)
  if (dishIds.length === 0) {
    console.log('No dishIds found in offers')
    return
  }

  const { data: dishes, error: dishesError } = await supabase.from('dishes').select('*').in('id', dishIds)
  if (dishesError) console.error('dishesError', dishesError.message)
  console.log('dishes:', dishes)

  const { data: ratings, error: ratingsError } = await supabase.from('ratings').select('*').in('dish_id', dishIds).eq('offer_date', date).eq('meal', meal)
  if (ratingsError) console.error('ratingsError', ratingsError.message)
  console.log('ratings:', ratings)
}

run().catch(e => console.error(e))
