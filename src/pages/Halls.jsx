import React from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const Halls = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = searchParams.get('meal')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [halls, setHalls] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  const handleHallClick = (hall) => {
    navigate(`/dishes?meal=${encodeURIComponent(meal)}&hall=${encodeURIComponent(hall)}&date=${encodeURIComponent(date)}`)
  }

  React.useEffect(() => {
    if (!meal || !date) return
    setLoading(true)
    fetch(`http://localhost:4000/api/halls?meal=${encodeURIComponent(meal)}&date=${encodeURIComponent(date)}`)
      .then(r => r.json())
      .then(data => setHalls(data || []))
      .catch(e => setError(e.message || 'Failed'))
      .finally(() => setLoading(false))
  }, [meal, date])

  return (
    <div>
      <button onClick={() => navigate(-1)}>Back</button>
  <h2>{meal ? (meal.charAt(0).toUpperCase() + meal.slice(1)) : 'Dining'} Dining Options</h2>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {!loading && !error && halls.length === 0 && (
        <p>No dining options found for {meal?.charAt(0).toUpperCase() + meal?.slice(1)} on {date}.</p>
      )}
      <div>
        {halls.map(h => {
          const avg = (h.avg_rating !== undefined && h.avg_rating !== null) ? h.avg_rating : (h.avg !== undefined ? h.avg : null)
          return (
            <div key={h.hall} onClick={() => handleHallClick(h.hall)} style={{ cursor: 'pointer' }}>
              <h2>{h.hall.charAt(0).toUpperCase() + h.hall.slice(1).replace('-', ' ')}</h2>
              <p>Average Rating: {avg !== null ? Number(avg).toFixed(2) : 'N/A'} ({h.rating_count || 0} ratings)</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Halls;
