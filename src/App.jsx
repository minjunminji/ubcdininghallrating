import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Halls from './pages/Halls'
import Dishes from './pages/Dishes'
import Rate from './pages/Rate'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="halls" element={<Halls />} />
          <Route path="dishes" element={<Dishes />} />
          <Route path="rate" element={<Rate />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
