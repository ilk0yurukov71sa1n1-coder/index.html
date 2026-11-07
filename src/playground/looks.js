import { lazy } from 'react';

// Each background the site uses, with the values it has live today and the controls the playground shows.
// `live` mirrors the props in the file named by `where`, so "Reset" always returns to what visitors see.
const range = (key, label, min, max, step) => ({ key, label, type: 'range', min, max, step });
const color = (key, label) => ({ key, label, type: 'color' });
const select = (key, label, options) => ({ key, label, type: 'select', options });

const PAPERS = ['anthropic-caching', 'routellm', 'semantic-cache', 'openai-batch', 'llmlingua'].map((id, i) => ({
  src: `/media/papers/${id}.jpg`,
  alt: `Report cover ${i + 1}`,
  title: ['Prompt caching', 'Model routing', 'Semantic cache', 'Batch pricing', 'Prompt compression'][i],
}));

export const LOOKS = [
  {
    id: 'drift-wall',
    name: 'Drift wall',
    where: 'Pricing section tiles · src/components/reactbits/DriftWall.jsx',
    stage: 'dark',
    Comp: lazy(() => import('../components/reactbits/DriftWall')),
    component: 'DriftWall',
    fixed: { items: PAPERS.map((p) => ({ image: p.src, title: p.title })) },
    live: {
      columns: 5, tileWidth: 200, tileHeight: 132, gap: 18, tilt: 16, turn: -14, perspective: 1200, depth: 120,
      speed: 42, direction: 'up', variance: 0.45, parallax: 0.6, lift: 64, fade: 0.6, dim: 0.55, overlayColor: '#060010',
    },
    restartKeys: ['columns'],
    controls: [
      range('columns', 'Columns', 2, 8, 1), range('tileWidth', 'Tile width', 120, 320, 1), range('tileHeight', 'Tile height', 80, 240, 1),
      range('gap', 'Gap', 0, 40, 1), range('tilt', 'Tilt', 0, 45, 1), range('turn', 'Turn', -45, 45, 1),
      range('perspective', 'Perspective', 400, 2400, 10), range('depth', 'Depth', 0, 300, 1), range('speed', 'Speed', 0, 120, 1),
      select('direction', 'Direction', ['up', 'down']), range('variance', 'Speed variety', 0, 1, 0.01),
      range('parallax', 'Parallax', 0, 1.5, 0.01), range('lift', 'Hover lift', 0, 160, 1), range('fade', 'Edge fade', 0, 1, 0.01),
      range('dim', 'Dim', 0, 1, 0.01), color('overlayColor', 'Overlay colour'),
    ],
  },
  {
    id: 'scroll-expand',
    name: 'Scroll expand',
    where: 'A framed picture that opens to fill the stage as you scroll · src/components/reactbits/ScrollExpand.jsx',
    stage: 'light',
    Comp: lazy(() => import('../components/reactbits/ScrollExpand')),
    component: 'ScrollExpand',
    fixed: { src: '/media/silk-pro.jpg', alt: 'Report cover', title: 'Built to scale' },
    live: { mediaZoom: 1.35, startWidth: 42, startHeight: 58, startRadius: 24, scrollDistance: 1.2, overlayScrim: 0.45 },
    controls: [
      range('mediaZoom', 'Picture zoom', 1, 2, 0.01), range('startWidth', 'Start width', 20, 80, 1),
      range('startHeight', 'Start height', 20, 90, 1), range('startRadius', 'Start rounding', 0, 48, 1),
      range('scrollDistance', 'Scroll length', 0.5, 3, 0.05), range('overlayScrim', 'Text shade', 0, 1, 0.01),
    ],
  },
  {
    id: 'flex-carousel',
    name: 'Flex carousel',
    where: 'Library section covers · src/components/reactbits/FlexCarousel.jsx',
    stage: 'light',
    Comp: lazy(() => import('../components/reactbits/FlexCarousel')),
    component: 'FlexCarousel',
    fixed: { items: PAPERS },
    live: { preset: 'liquid', intro: 'rise', cardHeight: 0.5, gap: 12, squeeze: 0.2, focusOnClick: true, captions: true },
    controls: [
      select('preset', 'Preset', ['liquid']), select('intro', 'Intro', ['rise', 'none']),
      range('cardHeight', 'Card height', 0.3, 0.9, 0.01), range('gap', 'Gap', 0, 40, 1), range('squeeze', 'Squeeze', 0, 0.6, 0.01),
    ],
  },
  {
    id: 'flux-lines',
    name: 'Flux lines',
    where: 'Dark section background, white flowing lines · src/components/reactbits/FluxLines.jsx',
    stage: 'dark',
    Comp: lazy(() => import('../components/reactbits/FluxLines')),
    component: 'FluxLines',
    fixed: { colors: ['#ffffff', '#ffffff', '#ffffff'] },
    live: {
      speed: 0.5, scale: 1.6, turbulence: 1, fluidity: 0.1, rimWidth: 0.2, sharpness: 2.5, shimmer: 1.5, glow: 2,
      lineWidth: 1, flowDirection: 'down', mouseInteraction: true, clickSwirl: true,
    },
    controls: [
      range('speed', 'Speed', 0, 2, 0.01), range('scale', 'Size', 0.5, 4, 0.05), range('turbulence', 'Turbulence', 0, 3, 0.05),
      range('fluidity', 'Fluidity', 0.01, 1, 0.01), range('rimWidth', 'Line softness', 0.02, 1, 0.01),
      range('sharpness', 'Sharpness', 0.5, 6, 0.1), range('shimmer', 'Shimmer', 0, 4, 0.05), range('glow', 'Glow', 0, 5, 0.05),
      range('lineWidth', 'Line width', 0, 4, 0.1), select('flowDirection', 'Flow', ['down', 'up', 'left', 'right']),
    ],
  },
  {
    id: 'beams',
    name: 'Beams',
    where: 'Dark section background, soft light beams · src/components/reactbits/Beams.jsx',
    stage: 'dark',
    Comp: lazy(() => import('../components/reactbits/Beams')),
    component: 'Beams',
    live: { color: '#ffffff', beamWidth: 140, rotation: 30, speed: 1, glow: 0.6 },
    controls: [
      color('color', 'Colour'), range('beamWidth', 'Beam width', 20, 400, 1), range('rotation', 'Angle', -90, 90, 1),
      range('speed', 'Speed', 0, 3, 0.05), range('glow', 'Glow', 0, 2, 0.05),
    ],
  },
  {
    id: 'accordion-gallery',
    name: 'Accordion gallery',
    where: 'Row of pictures where the one you point at opens · src/components/reactbits/AccordionGallery.jsx',
    stage: 'light',
    noGL: true,
    Comp: lazy(() => import('../components/reactbits/AccordionGallery')),
    component: 'AccordionGallery',
    fixed: {
      items: [
        { image: '/media/silk-starter.jpg', label: 'Starter', link: '#' },
        { image: '/media/silk-pro.jpg', label: 'Pro', link: '#' },
        { image: '/media/silk-team.jpg', label: 'Team', link: '#' },
        { image: '/media/silk-scale.jpg', label: 'Scale', link: '#' },
        { image: '/media/silk-business.jpg', label: 'Business', link: '#' },
      ],
    },
    live: { defaultIndex: 2, expandRatio: 0.52, trigger: 'hover' },
    controls: [
      range('defaultIndex', 'Open at start', 0, 4, 1), range('expandRatio', 'Open width', 0.3, 0.8, 0.01),
      select('trigger', 'Opens on', ['hover', 'click']),
    ],
  },
  {
    id: 'infinite-spiral',
    name: 'Infinite spiral',
    where: 'Pictures turning around a spiral, drag or scroll · src/components/reactbits/InfiniteSpiral.jsx',
    stage: 'light',
    noGL: true,
    Comp: lazy(() => import('../components/reactbits/InfiniteSpiral')),
    component: 'InfiniteSpiral',
    fixed: {
      items: ['silk-starter', 'silk-pro', 'silk-team', 'silk-scale', 'silk-business', 'oxblood-silk'].map((n, i) => ({
        src: `/media/${n}.jpg`,
        alt: `Picture ${i + 1}`,
      })),
    },
    live: {
      animationMode: 'all', speed: 0.55, radius: 170, cardWidth: 100, cardHeight: 100, verticalSpacing: 60,
      perspective: 1000, cardRadius: 10, centerScale: 1.2, edgeBlur: 6, cardsPerTurn: 7, pauseOnHover: true,
    },
    restartKeys: ['cardsPerTurn'],
    controls: [
      select('animationMode', 'Moves by', ['all', 'auto', 'scroll', 'drag']), range('speed', 'Speed', 0, 2, 0.01),
      range('radius', 'Spiral width', 60, 360, 1), range('cardWidth', 'Card width', 60, 260, 1), range('cardHeight', 'Card height', 60, 260, 1),
      range('verticalSpacing', 'Spacing', 20, 160, 1), range('perspective', 'Perspective', 400, 2400, 10),
      range('cardRadius', 'Rounding', 0, 40, 1), range('centerScale', 'Middle size', 1, 2, 0.01),
      range('edgeBlur', 'Edge blur', 0, 16, 0.5), range('cardsPerTurn', 'Cards per turn', 3, 14, 1),
    ],
  },
  {
    id: 'site',
    name: 'Site background',
    where: 'Every page of the main site · src/components/ui/SiteBackground.jsx',
    stage: 'light',
    Comp: lazy(() => import('../components/reactbits/GhostFibers')),
    component: 'GhostFibers',
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
    component: 'LineWaves',
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
    component: 'FluidGlass',
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
    component: 'Ferrofluid',
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
    component: 'DitherVeil',
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
    component: 'MicroSlats',
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
  vault('text-styles', 'Text Styles', 'Text effects', 'Sixteen animated text styles in one list: line reveal, marquee, hand-drawn notes, split-flap, glass shatter, laser etch, molten gold, neon tube and more. Pick one on the left.'),
  vault('all-buttons', 'Button Motion Collection', 'Buttons', 'All 76 button designs, live: hover, tap and hold each one, or open one full screen. Rewards, state morphs, hover feel, futuristic, fully 3D, professional sets, premium 3D and the ink family.'),
  vault('cursors-3d', '3D Cursors', 'Cursors', 'Twelve 3D cursor effects in one lab. Lab only: client pages do not get cursor animation.'),
  vault('file-pop-panel', 'File Pop Panel', 'Panels', 'A file card that pops open into a panel. Click it to open and close.'),
];
