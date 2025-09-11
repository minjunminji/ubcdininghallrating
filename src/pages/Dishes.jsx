import React from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const Dishes = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = searchParams.get('meal')
  const hall = searchParams.get('hall')
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

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
      .then(data => setStations(data || []))
      .catch(e => setError(e.message || 'Failed'))
      .finally(() => setLoading(false))
  }, [meal, hall, date])

  return (
    <div>
      <button onClick={() => navigate(-1)}>Back</button>
      <h2>{formatName(hall)} - {formatName(meal)}</h2>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}

      {stations.map(station => (
        <div key={station.station}>
          <h2>{station.station}</h2>
          <ul>
            {(station.dishes || []).map(dish => (
              <li key={dish.id}>
                    <strong>{dish.name}</strong> — {dish.avg_rating !== null && dish.avg_rating !== undefined
                      ? `${Number(dish.avg_rating).toFixed(2)} ⭐`
                      : 'N/A'} {`(${dish.num_ratings || 0} ratings)`}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default Dishes;
