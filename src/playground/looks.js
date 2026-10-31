import { lazy } from 'react';

// Each background the site uses, with the values it has live today and the controls the playground shows.
// `live` mirrors the props in the file named by `where`, so "Reset" always returns to what visitors see.
const range = (key, label, min, max, step) => ({ key, label, type: 'range', min, max, step });
const color = (key, label) => ({ key, label, type: 'color' });
const select = (key, label, options) => ({ key, label, type: 'select', options });

export const LOOKS = [
  {
    id: 'site',
    name: 'Site background',
    where: 'Every page of the main site · src/components/ui/SiteBackground.jsx',
    stage: 'light',
    Comp: lazy(() => import('../components/reactbits/GhostFibers')),
    fixed: { lightMode: true, intro: false },
    restartKeys: ['threads', 'layers'],
    live: {
      glowColor: '#7d1d20', secondaryColor: '#c9a59c', gradient: 'along', fiberStyle: 'dots',
      threads: 72, layers: 3, speed: 0.25, scale: 1.15, rotation: 18, depthOfField: 0.9,
      particles: 0.2, sparkle: 0.15, glow: 0.6, vignette: 0, grain: 0.03, hoverEffect: 'focus', mouseStrength: 0.8,
    },
    controls: [
      color('glowColor', 'Main colour'), color('secondaryColor', 'Second colour'),
      select('gradient', 'Colour blend', ['depth', 'along', 'across']),
      select('fiberStyle', 'Fibre style', ['dots', 'dashes', 'lines']),
      range('threads', 'Threads', 16, 120, 1), range('layers', 'Layers', 1, 5, 1),
      range('speed', 'Speed', 0, 1.5, 0.01), range('scale', 'Size', 0.5, 2.5, 0.01),
      range('rotation', 'Angle', -90, 90, 1), range('depthOfField', 'Depth blur', 0, 1, 0.01),
      range('particles', 'Particles', 0, 1, 0.01), range('sparkle', 'Sparkle', 0, 1, 0.01),
      range('glow', 'Glow', 0, 1.5, 0.01), range('vignette', 'Dark edges', 0, 1, 0.01),
      range('grain', 'Film grain', 0, 0.2, 0.005),
      select('hoverEffect', 'Mouse effect', ['focus', 'part', 'none']), range('mouseStrength', 'Mouse strength', 0, 2, 0.01),
    ],
  },
  {
    id: 'book-waves',
    name: 'Booking page lines',
    where: 'Booking page background · src/book/Book.jsx',
    stage: 'light',
    Comp: lazy(() => import('../components/reactbits/LineWaves')),
    fixed: { lightMode: true, intro: false, maxDevicePixelRatio: 1.5 },
    restartKeys: ['lineCount'],
    live: {
      color1: '#7d1d20', color2: '#b0323a', color3: '#4f1012', speed: 0.18, lineCount: 56, lineWidth: 1.1,
      glow: 0.4, highlight: 0.8, warpIntensity: 0.9, rotation: -28, mouseInfluence: 1.4, opacity: 0.34,
    },
    controls: [
      color('color1', 'Colour 1'), color('color2', 'Colour 2'), color('color3', 'Colour 3'),
      range('speed', 'Speed', 0, 1, 0.01), range('lineCount', 'Lines', 12, 120, 1),
      range('lineWidth', 'Line width', 0.3, 3, 0.05), range('glow', 'Glow', 0, 1.5, 0.01),
      range('highlight', 'Highlight', 0, 2, 0.01), range('warpIntensity', 'Wave strength', 0, 2, 0.01),
      range('rotation', 'Angle', -90, 90, 1), range('mouseInfluence', 'Mouse strength', 0, 4, 0.05),
      range('opacity', 'Strength', 0.05, 1, 0.01),
    ],
  },
  {
    id: 'book-glass',
    name: 'Booking page glass',
    where: 'Booking page hero · src/book/Book.jsx',
    stage: 'light',
    Comp: lazy(() => import('../components/reactbits/FluidGlass')),
    fixed: { intro: false, maxDevicePixelRatio: 1.75, shapes: ['lens', 'pill', 'blob'], fontWeight: 600 },
    restartKeys: ['text'],
    live: {
      text: 'Salon\nAurora', textColor: '#7d1d20', shape: 'lens', size: 210, refraction: 1, dispersion: 0.3,
      reflection: 1, frost: 0, tint: 0, color: '#ffffff', shadow: 0.35, elevation: 0.4, wobble: 0.4, spin: 0.2,
    },
    controls: [
      { key: 'text', label: 'Text behind the glass', type: 'text' }, color('textColor', 'Text colour'),
      select('shape', 'Shape', ['lens', 'blob', 'cube', 'pill', 'torus', 'prism', 'diamond']),
      range('size', 'Glass size', 80, 400, 1), range('refraction', 'Bend', 0, 2, 0.01),
      range('dispersion', 'Rainbow edge', 0, 1, 0.01), range('reflection', 'Shine', 0, 2, 0.01),
      range('frost', 'Frost', 0, 1, 0.01), color('color', 'Glass tint'), range('tint', 'Tint amount', 0, 1, 0.01),
      range('shadow', 'Shadow', 0, 1, 0.01), range('elevation', 'Lift', 0, 1, 0.01),
      range('wobble', 'Wobble', 0, 1, 0.01), range('spin', 'Spin', 0, 1, 0.01),
    ],
  },
  {
    id: 'cost',
    name: 'Dark band liquid',
    where: 'Landing page "What a leaked key costs" band · src/sections/Cost.jsx',
    stage: 'dark',
    Comp: lazy(() => import('../components/reactbits/Ferrofluid')),
    fixed: { transparent: false, intro: false, mouseInteraction: true, clickPulse: true, dpr: 1.5 },
    live: {
      color: '#150b0b', c1: '#f4f1ec', c2: '#b0323a', c3: '#c9a59c', brightness: 1.5, scale: 1.3,
      spikeHeight: 1.15, sharpness: 2.6, tilt: 52, speed: 0.4, magnetism: 2, flowDirection: 'down', mouseStrength: 1.15,
    },
    toProps: ({ c1, c2, c3, ...v }) => ({ ...v, colors: [c1, c2, c3] }),
    controls: [
      color('color', 'Background'), color('c1', 'Colour 1'), color('c2', 'Colour 2'), color('c3', 'Colour 3'),
      range('brightness', 'Brightness', 0.2, 3, 0.01), range('scale', 'Size', 0.5, 3, 0.01),
      range('spikeHeight', 'Spike height', 0, 2, 0.01), range('sharpness', 'Sharpness', 0.5, 5, 0.05),
      range('tilt', 'Tilt', 0, 90, 1), range('speed', 'Speed', 0, 1.5, 0.01), range('magnetism', 'Pull', 0, 4, 0.05),
      select('flowDirection', 'Flow', ['down', 'up', 'left', 'right', 'none']), range('mouseStrength', 'Mouse strength', 0, 3, 0.05),
    ],
  },
  {
    id: 'hero',
    name: 'Hero photo veil',
    where: 'Landing page hero panel · src/sections/Hero.jsx',
    stage: 'light',
    photo: true,
    Comp: lazy(() => import('../components/reactbits/DitherVeil')),
    fixed: { fit: 'cover', wander: true },
    live: {
      src: '/media/rc-glass.jpg', pattern: 'floyd', pixelSize: 2, levels: 3, inkColor: '#4f1012', paperColor: '#f4f1ec',
      contrast: 1.35, brightness: -0.08, revealRadius: 170, softness: 0.6, linger: 1.2, rimColor: '#b0323a', rim: 0.4,
    },
    controls: [
      select('pattern', 'Dot pattern', ['floyd', 'atkinson']), range('pixelSize', 'Dot size', 1, 8, 1),
      range('levels', 'Tones', 2, 6, 1), color('inkColor', 'Ink'), color('paperColor', 'Paper'),
      range('contrast', 'Contrast', 0.5, 2.5, 0.01), range('brightness', 'Brightness', -0.5, 0.5, 0.01),
      range('revealRadius', 'Reveal circle', 40, 400, 1), range('softness', 'Circle softness', 0, 1, 0.01),
      range('linger', 'Linger', 0, 3, 0.05), color('rimColor', 'Rim colour'), range('rim', 'Rim', 0, 1, 0.01),
    ],
  },
  {
    id: 'services',
    name: 'Services slats',
    where: '/services page hero · src/services/Services.jsx',
    stage: 'dark',
    Comp: lazy(() => import('../components/reactbits/MicroSlats')),
    fixed: { intro: false },
    restartKeys: ['slatWidth', 'slatHeight', 'gap', 'preset'],
    live: {
      preset: 'tide', color: '#7d1d20', glintColor: '#d9474f', backgroundColor: '#14100f', slatWidth: 8, slatHeight: 22,
      gap: 3, roundness: 0.75, speed: 0.35, glint: 0.5, fog: 0.6, cursorStrength: 0.7, cursorSize: 46, trail: 1.4,
    },
    controls: [
      select('preset', 'Motion', ['swell', 'tide', 'storm', 'signal']), color('color', 'Colour'),
      color('glintColor', 'Glint colour'), color('backgroundColor', 'Background'),
      range('slatWidth', 'Slat width', 3, 24, 1), range('slatHeight', 'Slat height', 6, 60, 1), range('gap', 'Gap', 1, 10, 1),
      range('roundness', 'Roundness', 0, 1, 0.01), range('speed', 'Speed', 0, 1.5, 0.01), range('glint', 'Glint', 0, 1.5, 0.01),
      range('fog', 'Fog', 0, 1, 0.01), range('cursorStrength', 'Mouse strength', 0, 2, 0.05),
      range('cursorSize', 'Mouse size', 10, 120, 1), range('trail', 'Trail', 0, 3, 0.05),
    ],
  },
];


// The vault: ilko's own lab pages, kept whole so nothing in them is lost. Each one runs on its own page under /vault/.
// `kind` says what it is: a background to scroll, or a lab of parts (buttons, text, transitions, photo cards).
const vault = (id, name, kind, text) => ({ id, name, kind, text, frame: `/vault/${id}.html` });

export const VAULT = [
  vault('fiber-field', 'Fiber Field', 'Background', 'Silky 3D fibres that bend as you scroll. Scroll hard or swipe fast and they rip, then knit back together.'),
  vault('rip-through', 'Rip Through', 'Background', 'A 3D picture that tears open as you scroll and something comes through. Click the picture to break it; it grows back.'),
  vault('cloud-code', 'Cloud Code', 'Background', 'Pixel clouds you fall through as you scroll, into lines of code that spin, stream left and right, then zoom out into a sphere.'),
  vault('photo-reveal', 'Photo Reveal', 'Photo cards', 'Eight ways to open a photo card in 3D: unfold, dive, tiles, book, cube, fan, glass and blinds. Put in your own photos and text.'),
  vault('transition-lab', 'Transition Lab', 'Page transitions', 'Fifteen page transitions and eighteen loaders. Click a button inside the sample site to play one from that spot.'),
  vault('button-lab', '3D Button Lab', 'Buttons', 'Twelve 3D buttons you can press and tilt. Change the text, colour, depth and roundness.'),
  vault('text-motion-lab', 'Text Motion Lab', 'Text effects', 'Thirteen ways to make words move. Type your own headline and pick an effect.'),
];
