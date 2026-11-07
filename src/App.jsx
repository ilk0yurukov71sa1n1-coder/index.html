import Navbar from './sections/Navbar';
import Footer from './sections/Footer';
import SiteBackground from './components/ui/SiteBackground';
import ChatHelper from './components/ui/ChatHelper';
import PageIndex from './components/ui/PageIndex';
import { sections } from './config/sections';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteBackground />
      <Navbar />
      <PageIndex />
      <main id="main">
        {sections.map(({ id, Component }) => (
          <Component key={id} id={id} />
        ))}
      </main>
      <Footer />
      <ChatHelper />
    </>
  );
}
