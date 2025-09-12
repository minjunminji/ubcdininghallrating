import React from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const Halls = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = searchParams.get('meal')
  const todayLocalISO = () => {
    const d = new Date()
    const tzo = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzo).toISOString().slice(0,10)
  }
  const date = searchParams.get('date') || todayLocalISO()

  const [halls, setHalls] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  const handleHallClick = (hall) => {
    navigate(`/dishes?meal=${encodeURIComponent(meal)}&hall=${encodeURIComponent(hall)}&date=${encodeURIComponent(date)}`)
  }

  const displayName = (hall) => {
    if (!hall) return ''
    const map = { 'feast': 'totem park', 'gather': 'place vanier', 'open-kitchen': 'orchard commons' }
    return map[hall] || hall.replace('-', ' ')
  }

  const ratingClass = (avg) => {
    if (avg == null) return 'rating-mid'
    if (avg >= 4) return 'rating-high'
    if (avg >= 3) return 'rating-mid'
    return 'rating-low'
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
    <div className="halls">
      <div style={{ marginLeft: '24px', marginTop: '8px' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1) }} aria-label="Back">←</a>
      </div>

      {loading && <p style={{ marginLeft: '60px' }}>Loading...</p>}
      {error && <p style={{ marginLeft: '60px' }}>Error: {error}</p>}

      <div className="list">
        {halls.map(h => {
          const avg = (h.avg_rating !== undefined && h.avg_rating !== null) ? h.avg_rating : (h.avg !== undefined ? h.avg : null)
          const avgStr = avg != null ? Number(avg).toFixed(1) : '—'
          return (
            <div key={h.hall} className="row">
              <a href="#" onClick={(e) => { e.preventDefault(); handleHallClick(h.hall) }}>{displayName(h.hall)}</a>
              <span className={`avg ${ratingClass(avg)}`}>{avgStr}</span>
            </div>
          )
        })}
      </div>

      <a className="rateLink" href="#" onClick={(e) => { e.preventDefault(); navigate('/rate') }}>rate</a>
    </div>
  )
}

export default Halls;
