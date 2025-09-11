import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Home from './components/Home'
import Halls from './components/Halls'
import Dishes from './components/Dishes'
import Rate from './components/Rate'
import './App.css'

function App() {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/halls">Halls</Link></li>
            <li><Link to="/dishes">Dishes</Link></li>
            <li><Link to="/rate">Rate</Link></li>
          </ul>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/halls" element={<Halls />} />
          <Route path="/dishes" element={<Dishes />} />
          <Route path="/rate" element={<Rate />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
