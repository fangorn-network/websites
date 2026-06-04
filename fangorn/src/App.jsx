import './index.css';
import Nav from './Nav';
import Hero from './Hero';
import Products from './Products';
import Team from './Team';
import { Cta, Footer } from './Footer';

export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <Products />
      <Team />
      <Cta />
      <Footer />
    </>
  );
}
