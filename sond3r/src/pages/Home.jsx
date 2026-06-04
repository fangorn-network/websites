import EntryOverlay from '../components/EntryOverlay.jsx'
import Hero from '../components/Hero.jsx'
import ProblemStatement from '../components/ProblemStatement.jsx'
import ProductDescription from '../components/ProductDescription.jsx'
import Vision from '../components/Vision.jsx'
import Support from '../components/Support.jsx'
import Share from '../components/Share.jsx'
import FAQ from '../components/FAQ.jsx'

export default function Home() {
  return (
    <>
      <EntryOverlay />
      <main className="container">
        <Hero />
        <ProblemStatement />
        <ProductDescription />
        <Vision />
        <Support />
        <Share />
        <FAQ />
      </main>
    </>
  )
}
