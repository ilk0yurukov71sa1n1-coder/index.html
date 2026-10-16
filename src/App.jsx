import Navbar from './sections/Navbar';
import Footer from './sections/Footer';
import { sections } from './config/sections';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar />
      <main id="main">
        {sections.map(({ id, Component }) => (
          <Component key={id} id={id} />
        ))}
      </main>
      <Footer />
    </>
  );
}
