import { useEffect, useRef } from 'react';
import { story } from '../config/site';
import Reveal from '../components/ui/Reveal';
import '@fontsource/marck-script/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/cyrillic-400-italic.css';
import '@fontsource/marck-script/cyrillic-400.css';
import './Story.css';

const VIDEO = 'https://res.cloudinary.com/daklr2whx/video/upload/v1778602552/track-video_2_s9lp53.mp4';

// Why Rollcfluence exists: a red band with the mission, a signature and a
// looping video that fades up out of the red. The video only plays while on screen.
export default function Story({ id }) {
  const video = useRef(null);

  useEffect(() => {
    const v = video.current;
    if (!v || typeof IntersectionObserver === 'undefined') return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !reduce) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <section id={id} className="story" aria-label={story.label}>
      <div className="story__body">
        <Reveal className="story__inner">
          <img className="story__logo" src="/logo-rc.png" alt="" width="80" height="80" />
          <p className="story__mission">{story.mission}</p>
          <p className="story__sign" aria-label={story.sign}>{story.sign}</p>
          <div className="story__text">
            {story.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {story.closing && <p className="story__closing">{story.closing}</p>}
          </div>
        </Reveal>
      </div>
      <div className="story__media" aria-hidden="true">
        <div className="story__fade" />
        <video ref={video} autoPlay loop muted playsInline preload="auto">
          <source src={VIDEO} type="video/mp4" />
        </video>
      </div>
    </section>
  );
}
