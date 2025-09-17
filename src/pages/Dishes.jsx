import React from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { fetchJsonCached } from '../lib/fetchCache'

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
  const url = `http://localhost:4000/api/dishes?hall=${encodeURIComponent(hall)}&meal=${encodeURIComponent(meal)}&date=${encodeURIComponent(date)}`
  fetchJsonCached(url, { ttl: 60000 })
      .then(data => setStations(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message || 'Failed'))
      .finally(() => setLoading(false))
  }, [meal, hall, date])

  const ratingClass = (avg) => {
    if (avg == null) return 'rating-none'
    if (avg >= 4) return 'rating-high'
    if (avg >= 3) return 'rating-mid'
    return 'rating-low'
  }

  const shouldHideDish = (name) => {
    const n = (name || '').toString().trim().toLowerCase()
    return n === 'check dining location for daily offering' || n === 'check dining location for daily offerings'
  }

  const baseDishName = (name) => {
    let n = (name || '').toString().toLowerCase().trim()
    // strip suffix after hyphen/en-dash/em-dash and trim
    n = n.replace(/\s*[-–—]\s*.*/, '')
    // strip trailing parenthetical qualifiers
    n = n.replace(/\s*\([^)]*\)\s*$/, '')
    // collapse spaces
    n = n.replace(/\s+/g, ' ').trim()
    return n
  }

  return (
    <div className="dishes">
      <div style={{ marginLeft: '60px', marginTop: '8px' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1) }} aria-label="Back">&lt;- back</a>
      </div>

      {loading && <p style={{ marginLeft: '60px' }}>Loading...</p>}
      {error && <p style={{ marginLeft: '60px' }}>Error: {error}</p>}

      <div className="grid">
        {stations.map(st => (
          <div className="station" key={st.station}>
            <div className="station-header static">
              <span className="title">{(st.station || '').toLowerCase()}</span>
            </div>
            <ul className="dish-list">
              {(() => {
                // Group variations under a base name and compute weighted avg
                const groups = new Map()
                for (const d of (st.dishes || [])) {
                  if (shouldHideDish(d.name)) continue
                  const base = baseDishName(d.name)
                  if (!groups.has(base)) groups.set(base, { name: base, sum: 0, count: 0 })
                  const avg = d.avg_rating
                  const cnt = Number(d.num_ratings || 0)
                  if (avg != null && cnt > 0) {
                    const g = groups.get(base)
                    g.sum += Number(avg) * cnt
                    g.count += cnt
                  }
                }
                const deduped = Array.from(groups.values()).map(g => ({ name: g.name, avg: g.count ? g.sum / g.count : null }))
                return deduped.map((item, idx) => {
                  const avg = item.avg
                  const avgStr = avg != null ? Number(avg).toFixed(1) : '—'
                  return (
                    <li key={`${st.station}-${item.name}-${idx}`} className="dish-row">
                      <span className="name">{item.name}</span>
                      <span className={`avg ${ratingClass(avg)}`}>{avgStr}</span>
                    </li>
                  )
                })
              })()}
            </ul>
          </div>
        ))}
      </div>

      <a className="rateLink" href="#" onClick={(e) => { e.preventDefault(); navigate('/rate') }}>rate</a>
    </div>
  )
}

export default Dishes;
