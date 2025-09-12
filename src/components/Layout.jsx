import { Outlet } from 'react-router-dom'

const Layout = () => {
  return (
    <>
      <header>
        <h1>insertwebsitename</h1>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}

export default Layout
