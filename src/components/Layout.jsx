import { Link, Outlet } from 'react-router-dom'

const Layout = () => {
  return (
    <>
      <header>
        <h1>Dining Hall Rating</h1>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}

export default Layout
