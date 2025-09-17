import { Outlet, Link } from 'react-router-dom'

const Layout = () => {
  return (
    <>
      <header>
        <h1>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>insertwebsitename</Link>
        </h1>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}

export default Layout
