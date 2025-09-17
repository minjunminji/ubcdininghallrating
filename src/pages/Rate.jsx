import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StarRating from '../components/StarRating'
import { fetchJsonCached } from '../lib/fetchCache'

const Rate = () => {
  const [selectedMeal, setSelectedMeal] = useState('')
  const [selectedHall, setSelectedHall] = useState('')
  // Use today's local date for rating; no selector needed
  const todayLocalISO = () => {
    const d = new Date()
    const tzo = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzo).toISOString().slice(0,10)
  }
  const date = todayLocalISO()

  const [stations, setStations] = useState([])
  const [openMap, setOpenMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState({})

  // ratings: { [dishId]: number }
  const [ratings, setRatings] = useState({})
  // submitted flags to avoid double-posting
  const [submitted, setSubmitted] = useState({})
  const [sending, setSending] = useState({})
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const meals = [
    { value: 'breakfast', label: 'breakfast' },
    { value: 'lunch', label: 'lunch' },
    { value: 'dinner', label: 'dinner' },
  ]
  const halls = [
    { value: 'feast', label: 'totem park' },
    { value: 'gather', label: 'place vanier' },
    { value: 'open-kitchen', label: 'orchard commons' },
  ]

  const fetchDishes = async (hallArg, mealArg) => {
    const hallVal = hallArg || selectedHall
    const mealVal = mealArg || selectedMeal
    if (!hallVal || !mealVal || !date) return
    setError(null)
    setLoading(true)
    try {
      const url = `http://localhost:4000/api/dishes?hall=${encodeURIComponent(hallVal)}&meal=${encodeURIComponent(mealVal)}&date=${encodeURIComponent(date)}`
      const data = await fetchJsonCached(url, { ttl: 60000 })
      const arr = Array.isArray(data) ? data : []
      setStations(arr)
      // initialize all stations as collapsed
      const init = {}
      arr.forEach(s => { init[s.station] = false })
      setOpenMap(init)
    } catch (e) {
      setError('Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // when both are chosen, fetch
    if (selectedHall && selectedMeal) fetchDishes(selectedHall, selectedMeal)
  }, [selectedHall, selectedMeal])

  const onSelectMeal = (v) => {
    setSelectedMeal(v)
    if (selectedHall && v) fetchDishes(selectedHall, v)
  }
  const onSelectHall = (v) => {
    setSelectedHall(v)
    if (v && selectedMeal) fetchDishes(v, selectedMeal)
  }

  const postRating = async (dishId, ratingVal) => {
    if (!Number.isFinite(Number(dishId))) {
      setMessage('Invalid dish id')
      return
    }
    setSending(prev => ({ ...prev, [dishId]: true }))
    try {
      const res = await fetch('http://localhost:4000/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: Number(dishId), meal: selectedMeal, offer_date: date, rating: Number(ratingVal) })
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed')
      }
  setSubmitted(prev => ({ ...prev, [dishId]: true }))
  setMessage('Rating submitted!')
  // refresh dishes to get updated avg/num_ratings; show per-dish refreshing indicator
  setRefreshing(prev => ({ ...prev, [dishId]: true }))
  await fetchDishes()
  setRefreshing(prev => ({ ...prev, [dishId]: false }))
      return true
    } catch (err) {
      setMessage(err.message || 'Submission failed')
      return false
    } finally {
      setSending(prev => ({ ...prev, [dishId]: false }))
    }
  }

  const handleStarClick = (dishId, ratingVal) => {
    setRatings(prev => ({ ...prev, [dishId]: ratingVal }))
    // Do not submit immediately; wait for Submit button
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    const entries = Object.entries(ratings).filter(([dishId]) => !submitted[dishId])
    if (entries.length === 0) {
      setMessage('No ratings to submit')
      return
    }
    let allOk = true
    for (const [dishId, ratingVal] of entries) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await postRating(dishId, ratingVal)
      if (!ok) allOk = false
    }
    if (allOk) {
      // Navigate home with flash message
      navigate('/', { state: { flash: 'rating submitted' } })
      return
    }
    // If some failed, refresh once to reflect any updates
    await fetchDishes()
  }

  return (
    <div className="ratePage">
      <form onSubmit={handleSubmit}>
        {/* Meal tabs */}
        <div className="tabRow" style={{ marginTop: '16px' }}>
          {meals.map(m => (
            <a key={m.value} href="#" className={`tab ${selectedMeal === m.value ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onSelectMeal(m.value) }}>{m.label}</a>
          ))}
        </div>
        {/* Hall tabs */}
        <div className="tabRow" style={{ marginTop: '8px' }}>
          {halls.map(h => (
            <a key={h.value} href="#" className={`tab ${selectedHall === h.value ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onSelectHall(h.value) }}>{h.label}</a>
          ))}
        </div>

        {(!selectedMeal || !selectedHall) && (
          <p style={{ marginLeft: '60px' }}>Choose a meal and hall to start rating.</p>
        )}

        {selectedMeal && selectedHall && (
          <div className="rateList">
            {(stations || []).map(s => {
              const isOpen = !!openMap[s.station]
              const allDishes = Array.isArray(s.dishes) ? s.dishes : []
              const ratedDishes = allDishes.filter(d => ratings[d.id])
              const visible = isOpen ? allDishes : ratedDishes
              return (
                <div key={s.station} className="rateSection">
                  <div className="rateHeader" onClick={() => setOpenMap(m => ({ ...m, [s.station]: !m[s.station] }))}>
                    <span className="chev">{isOpen ? '▾' : '›'}</span>
                    <span className="title">{s.station}</span>
                  </div>
                  {visible.length > 0 && (
                    <div className="rateDishes">
                      {visible.map(d => (
                        <div key={d.id} className="rateRow">
                          <span className="name">{d.name}</span>
                          <span className="stars"><StarRating name={`rate-${d.id}`} value={ratings[d.id] || 0} onChange={(v) => handleStarClick(d.id, v)} /></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {selectedMeal && selectedHall && !loading && (stations || []).length === 0 && (
          <p style={{ marginLeft: '60px' }}>No stations found for today.</p>
        )}

        <a className="submitLink" href="#" onClick={(e) => { e.preventDefault(); handleSubmit(e) }}>submit</a>
        {message && <p style={{ marginLeft: '60px' }}>{message}</p>}
      </form>
    </div>
  )
}

export default Rate
