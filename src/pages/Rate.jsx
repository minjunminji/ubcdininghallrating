import React, { useState, useEffect } from 'react'

const Rate = () => {
  const [selectedMeal, setSelectedMeal] = useState('')
  const [selectedHall, setSelectedHall] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState({})

  // ratings: { [dishId]: number }
  const [ratings, setRatings] = useState({})
  // submitted flags to avoid double-posting
  const [submitted, setSubmitted] = useState({})
  const [sending, setSending] = useState({})
  const [message, setMessage] = useState('')

  const meals = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
  ]
  const halls = [
    { value: 'feast', label: 'Feast' },
    { value: 'gather', label: 'Gather' },
    { value: 'open-kitchen', label: 'Open Kitchen' },
  ]

  const fetchDishes = async () => {
    setError(null)
    setStations([])
    if (!selectedHall || !selectedMeal || !date) return
    setLoading(true)
    try {
      const r = await fetch(`http://localhost:4000/api/dishes?hall=${encodeURIComponent(selectedHall)}&meal=${encodeURIComponent(selectedMeal)}&date=${encodeURIComponent(date)}`)
      if (!r.ok) throw new Error('Failed fetching dishes')
      const data = await r.json()
      setStations(data || [])
    } catch (e) {
      setError('Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDishes()
  }, [selectedHall, selectedMeal, date])

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
        body: JSON.stringify({ dish_id: Number(dishId), meal: mealParam, offer_date: date, rating: Number(ratingVal) })
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
    } catch (err) {
      setMessage(err.message || 'Submission failed')
    } finally {
      setSending(prev => ({ ...prev, [dishId]: false }))
    }
  }

  const handleStarClick = (dishId, ratingVal) => {
    setRatings(prev => ({ ...prev, [dishId]: ratingVal }))
    // send immediately
    postRating(dishId, ratingVal)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    const entries = Object.entries(ratings).filter(([dishId]) => !submitted[dishId])
    if (entries.length === 0) {
      setMessage('No ratings to submit')
      return
    }
    for (const [dishId, ratingVal] of entries) {
      // eslint-disable-next-line no-await-in-loop
      await postRating(dishId, ratingVal)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <h2>Select Meal</h2>
          <select value={selectedMeal} onChange={e => setSelectedMeal(e.target.value)}>
            <option value="">-- choose meal --</option>
            {meals.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <h2>Select Hall</h2>
          <select value={selectedHall} onChange={e => setSelectedHall(e.target.value)}>
            <option value="">-- choose hall --</option>
            {halls.map(h => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>

        <div>
          <h2>Date</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        {loading && <p>Loading...</p>}
        {error && <p>{error}</p>}

        {!loading && !error && stations.map(station => (
          <div key={station.station}>
            <h2>{station.station}</h2>
            <ul>
              {(station.dishes || []).map(d => (
                <li key={d.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <strong>{d.name}</strong>
                      {d.avg_rating != null && <span> — {Number(d.avg_rating).toFixed(2)} ⭐ ({d.num_ratings} ratings)</span>}
                      {(!d.num_ratings || d.num_ratings === 0) && <span> — N/A (0 ratings)</span>}
                    </div>
                    <div>
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleStarClick(d.id, star)}
                        >
                          {star <= (ratings[d.id] || 0) ? '\u2605' : '\u2606'}
                        </button>
                      ))}
                    </div>
                    <div>
                      {sending[d.id] ? <em>Sending...</em> : submitted[d.id] ? <em>Saved</em> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <button type="submit">Submit Ratings</button>
        {message && <p>{message}</p>}
      </form>
    </div>
  )
}

export default Rate
