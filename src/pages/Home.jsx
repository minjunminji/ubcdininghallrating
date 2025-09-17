import { useNavigate, useLocation } from 'react-router-dom'
import React from 'react'
import { prefetchJson } from '../lib/fetchCache'

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [showFlash, setShowFlash] = React.useState(!!(location.state && location.state.flash))
  const [fadeFlash, setFadeFlash] = React.useState(false)

  React.useEffect(() => {
    if (location.state && location.state.flash) {
      // Clear state so back/forward won't re-show
      navigate('.', { replace: true, state: {} })
    }
    if (showFlash) {
      const t1 = setTimeout(() => setFadeFlash(true), 1200)
      const t2 = setTimeout(() => setShowFlash(false), 1800)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [])

  const handleMealClick = (meal) => {
    navigate(`/halls?meal=${meal.toLowerCase()}`)
  }

  const todayLocalISO = () => {
    const d = new Date(); const tzo = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzo).toISOString().slice(0,10)
  }
  const prefetchHalls = (meal) => {
    const date = todayLocalISO()
    const url = `http://localhost:4000/api/halls?meal=${encodeURIComponent(meal.toLowerCase())}&date=${encodeURIComponent(date)}`
    prefetchJson(url, { ttl: 60000 })
  }

  return (
    <div className="home">
      {showFlash && (
        <div className={`flashOverlay ${fadeFlash ? 'fade' : ''}`}>
          <div className="flashMessage">rating submitted</div>
        </div>
      )}
      <div className="meals">
        <a href="#" onMouseEnter={() => prefetchHalls('Breakfast')} onClick={(e) => { e.preventDefault(); handleMealClick('Breakfast') }}>breakfast</a>
        <a href="#" onMouseEnter={() => prefetchHalls('Lunch')} onClick={(e) => { e.preventDefault(); handleMealClick('Lunch') }}>lunch</a>
        <a href="#" onMouseEnter={() => prefetchHalls('Dinner')} onClick={(e) => { e.preventDefault(); handleMealClick('Dinner') }}>dinner</a>
      </div>
      <a className="rateLink" href="#" onClick={(e) => { e.preventDefault(); navigate('/rate') }}>rate</a>
    </div>
  )
}

export default Home;
