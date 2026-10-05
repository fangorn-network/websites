import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Home from './pages/Home.jsx'
import DataNotice from './pages/legal/DataNotice.jsx'
import Terms from './pages/legal/Terms.jsx'
import Footer from './components/Footer.jsx'

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [path, setPath] = useState(read)
  const scrollPositions = useRef({})
  const prevPath = useRef(path)

  useEffect(() => {
    const onChange = () => {
      scrollPositions.current[prevPath.current] = window.scrollY
      setPath(read())
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // After the new page commits, restore its remembered position (top if none).
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPositions.current[path] ?? 0)
    prevPath.current = path
  }, [path])

  return path
}

const ROUTES = {
  '/privacy': DataNotice,
  '/terms': Terms,
}

export default function App() {
  const path = useHashRoute()
  const Page = ROUTES[path] || Home
  return (
    <>
      <Page />
      <Footer />
    </>
  )
}
