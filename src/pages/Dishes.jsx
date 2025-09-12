import React from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const Dishes = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = searchParams.get('meal')
  const hall = searchParams.get('hall')
  const todayLocalISO = () => {
    const d = new Date()
    const tzo = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzo).toISOString().slice(0,10)
  }
  const date = searchParams.get('date') || todayLocalISO()

  const [stations, setStations] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  const formatName = (name) => {
    if (!name) return ''
    return name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ')
  }

  React.useEffect(() => {
    if (!meal || !hall || !date) return
  setLoading(true)
  fetch(`http://localhost:4000/api/dishes?hall=${encodeURIComponent(hall)}&meal=${encodeURIComponent(meal)}&date=${encodeURIComponent(date)}`)
      .then(r => r.json())
      .then(data => setStations(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message || 'Failed'))
      .finally(() => setLoading(false))
  }, [meal, hall, date])

  const ratingClass = (avg) => {
    if (avg == null) return 'rating-mid'
    if (avg >= 4) return 'rating-high'
    if (avg >= 3) return 'rating-mid'
    return 'rating-low'
  }

  return (
    <div className="dishes">
      <div style={{ marginLeft: '24px', marginTop: '8px' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1) }} aria-label="Back">←</a>
      </div>

      {loading && <p style={{ marginLeft: '60px' }}>Loading...</p>}
      {error && <p style={{ marginLeft: '60px' }}>Error: {error}</p>}

      <div className="grid">
        {stations.map(st => (
          <div className="station" key={st.station}>
            <div className="station-header static">
              <span className="title">{st.station}</span>
            </div>
            <ul className="dish-list">
              {(st.dishes || []).map(d => {
                const avg = d.avg_rating
                const avgStr = avg != null ? Number(avg).toFixed(1) : '—'
                return (
                  <li key={d.id} className="dish-row">
                    <span className="name">{d.name}</span>
                    <span className={`avg ${ratingClass(avg)}`}>{avgStr}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <a className="rateLink" href="#" onClick={(e) => { e.preventDefault(); navigate('/rate') }}>rate</a>
    </div>
  )
}

export default Dishes;
