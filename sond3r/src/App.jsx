import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Home from './pages/Home.jsx'
import DataNotice from './pages/legal/DataNotice.jsx'
import Terms from './pages/legal/Terms.jsx'
import Footer from './components/Footer.jsx'

// Minimal hash-based routing. Keeps the app dependency-free and works on any
// static host — deep links like /#/privacy resolve without server rewrites.
// Remembers each page's scroll position so returning to a page (e.g. back to
// home from a legal page) restores where you were instead of jumping to top.
function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [path, setPath] = useState(read)
  const scrollPositions = useRef({})
  const prevPath = useRef(path)

  useEffect(() => {
    const onChange = () => {
      // Save the scroll position of the page we're leaving.
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
