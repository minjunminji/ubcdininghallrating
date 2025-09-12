import { useNavigate } from 'react-router-dom'

const Home = () => {
  const navigate = useNavigate()

  const handleMealClick = (meal) => {
    navigate(`/halls?meal=${meal.toLowerCase()}`)
  }

  return (
    <div className="home">
      <div className="meals">
        <a href="#" onClick={(e) => { e.preventDefault(); handleMealClick('Breakfast') }}>breakfast</a>
        <a href="#" onClick={(e) => { e.preventDefault(); handleMealClick('Lunch') }}>lunch</a>
        <a href="#" onClick={(e) => { e.preventDefault(); handleMealClick('Dinner') }}>dinner</a>
      </div>
      <a className="rateLink" href="#" onClick={(e) => { e.preventDefault(); navigate('/rate') }}>rate</a>
    </div>
  )
}

export default Home;
