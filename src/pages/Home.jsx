import { useNavigate } from 'react-router-dom'

const Home = () => {
  const navigate = useNavigate()

  const handleMealClick = (meal) => {
    navigate(`/halls?meal=${meal.toLowerCase()}`)
  }

  return (
    <div>
      <div>
        <button onClick={() => handleMealClick('Breakfast')}>Breakfast</button>
        <button onClick={() => handleMealClick('Lunch')}>Lunch</button>
        <button onClick={() => handleMealClick('Dinner')}>Dinner</button>
      </div>

      <button onClick={() => navigate('/rate')}>Rate Dishes</button>
    </div>
  )
}

export default Home;
