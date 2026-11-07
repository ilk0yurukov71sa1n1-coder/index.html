// Which package each piece belongs to: the lowest package that includes it, and who it suits.
// 1 Signature (ready-made, in the client's colours), 2 Concierge, 3 Flagship (custom-made for the brand), 4 Atelier (from scratch).
// These are proposals. ilko changes a level here and the playground, ranking and receipt all follow.
export const LEVELS = ['Signature', 'Concierge', 'Flagship', 'Atelier'];
// How many designs each package includes. Pick more than that and the order moves up to the next package. Atelier has no cap.
export const LIMITS = [3, 5, 8, Infinity];
export const levelForCount = (n) => (n ? LIMITS.findIndex((m) => n <= m) + 1 : 0);

const R = {
  // On the site now
  'drift-wall': [3, 'Photo-led businesses, hotels, salons'],
  'scroll-expand': [3, 'Hotels, venues, launches'],
  'flex-carousel': [3, 'Any business with 4 to 8 photos'],
  'flux-lines': [1, 'Calm, light brands'],
  'topography': [1, 'Outdoor, spa, mountain, wellness'],
  'beams': [1, 'Tech and service brands'],
  'accordion-gallery': [3, 'Portfolios, rooms, menus'],
  'infinite-spiral': [4, 'Studios, creative brands'],
  'wire-terrain': [3, 'Tech, mountain, travel'],
  'chrome-form': [4, 'Premium brands, jewellery, auto'],
  'mist-layers': [1, 'Spa, wellness, medical'],
  'gyro-rings': [3, 'Tech, engineering, precision services'],
  'signal-lines': [1, 'Security, tech, finance'],
  'tick-compass': [2, 'Watchmakers, outdoor, navigation'],
  'thread-loom': [3, 'Fashion, tailoring, craft'],
  'marble-veins': [3, 'Hotels, beauty, interiors'],
  'gravity-grid': [3, 'Tech, data, studios'],
  'cell-lattice': [2, 'Health, science, labs'],
  'caustic-floor': [3, 'Spa, pools, hotels, dive'],
  'field-lines': [3, 'Engineering, energy, tech'],
  'interference-fringes': [2, 'Optics, tech, design'],
  'twill-weave': [2, 'Fashion, textile, craft'],
  'strata-dome': [3, 'Architecture, real estate'],
  'chrome-slats': [3, 'Premium brands, auto, real estate'],
  'pin-relief': [3, 'Premium brands, design studios'],
  'monolith-field': [4, 'Real estate, architecture, finance'],
  'satin-sheet': [3, 'Fashion, beauty, hotels'],
  'ring-tunnel': [4, 'Tech, launches, security'],
  'bead-lattice': [3, 'Jewellery, beauty, tech'],
  'mercury-drops': [4, 'Luxury, studios, launches'],
  'isoline-drift': [2, 'Outdoor, mountain, maps'],
  'brushed-field': [3, 'Auto, industrial, premium services'],
  'moire-weave': [2, 'Fashion, design, textile'],
  'site': [1, 'Any business'],
  'book-waves': [1, 'Booking pages, salons, clinics'],
  'book-glass': [3, 'Booking pages, hotels'],
  'cost': [3, 'Tech and finance'],
  'hero': [3, 'Any business'],
  'services': [1, 'Service lists, agencies'],
  // Vault
  'fiber-field': [1, 'Any business'],
  'rip-through': [4, 'Launches, campaigns, studios'],
  'cloud-code': [4, 'Tech, software, launches'],
  'photo-reveal': [3, 'Hotels, restaurants, galleries'],
  'transition-lab': [4, 'Studios, portfolios, launches'],
  'button-lab': [3, 'Any business'],
  'text-motion-lab': [1, 'Any business'],
  'precision-buttons': [4, 'Premium brands, tech, studios'],
  'headline-3d': [4, 'Studios, launches, premium brands'],
  'click-loaders': [3, 'Booking, payments, members, hotels'],
  'all-buttons': [1, 'Any business'],
  'cursors-3d': [4, 'Only on request: cursor effects are off on client sites'],
  'file-pop-panel': [3, 'Portfolios, menus, rooms'],
  'scroll-3d': [4, 'Hotels, studios, launches, real estate'],
};

export const rankOf = (id) => {
  const [level, niche] = R[id] || [3, ''];
  return { level, niche, label: LEVELS[level - 1] };
};

// Scores out of 10 are my own judgement of each piece, so treat them as a proposal. Difficulty is 1 (quick) to 5 (hard to build and tune).
// Code is the size of the piece's main file in KB, measured. The shader backgrounds are small because the shared shader engine is not counted.
// [looks, hook, difficulty, codeKB]
const S = {
  'drift-wall': [8, 8, 3, 9.6],
  'scroll-expand': [8, 8, 3, 6.6],
  'flex-carousel': [7, 7, 3, 41.7],
  'flux-lines': [6, 5, 2, 16.1],
  'topography': [7, 6, 3, 56.1],
  'beams': [6, 6, 3, 21.3],
  'accordion-gallery': [7, 7, 2, 7.2],
  'infinite-spiral': [8, 9, 4, 9.6],
  'wire-terrain': [7, 7, 3, 3.9],
  'chrome-form': [9, 9, 5, 2.5],
  'mist-layers': [6, 5, 2, 1.7],
  'gyro-rings': [7, 7, 3, 2.7],
  'signal-lines': [6, 6, 2, 2.1],
  'tick-compass': [7, 6, 3, 2],
  'thread-loom': [7, 7, 3, 2.1],
  'marble-veins': [8, 6, 3, 1.6],
  'gravity-grid': [7, 7, 3, 1.7],
  'cell-lattice': [7, 6, 3, 2],
  'caustic-floor': [8, 7, 3, 1.7],
  'field-lines': [7, 7, 3, 1.9],
  'interference-fringes': [7, 6, 3, 1.6],
  'twill-weave': [7, 6, 3, 1.9],
  'strata-dome': [7, 6, 3, 1.9],
  'chrome-slats': [9, 8, 4, 3.3],
  'pin-relief': [9, 9, 4, 3.8],
  'monolith-field': [8, 8, 4, 3.5],
  'satin-sheet': [8, 8, 4, 2.8],
  'ring-tunnel': [8, 9, 4, 2.7],
  'bead-lattice': [8, 8, 4, 3.5],
  'mercury-drops': [9, 9, 5, 3.4],
  'isoline-drift': [7, 6, 3, 1.8],
  'brushed-field': [7, 6, 3, 2.4],
  'moire-weave': [7, 7, 3, 1.9],
  'site': [7, 6, 3, 38.8],
  'book-waves': [6, 6, 2, 17.6],
  'book-glass': [7, 6, 3, 48.9],
  'cost': [8, 7, 4, 31.4],
  'hero': [8, 8, 4, 25.5],
  'services': [6, 5, 2, 29.3],
  'fiber-field': [8, 8, 4, 22.3],
  'rip-through': [9, 10, 5, 28.4],
  'cloud-code': [9, 10, 5, 39],
  'photo-reveal': [8, 8, 4, 56.6],
  'transition-lab': [8, 8, 4, 46.7],
  'button-lab': [7, 7, 3, 33.5],
  'text-motion-lab': [7, 7, 3, 29.9],
  'precision-buttons': [8, 8, 4, 21.7],
  'headline-3d': [9, 9, 4, 18.7],
  'click-loaders': [9, 9, 4, 60.1],
  'all-buttons': [7, 7, 3, 453.8],
  'cursors-3d': [8, 8, 4, 40.4],
  'file-pop-panel': [7, 8, 3, 34.9],
  'scroll-3d': [8, 9, 4, 13.1],
};

export const scoreOf = (id) => {
  const [looks, hook, diff, kb] = S[id] || [7, 7, 3, 0];
  return { looks, hook, diff, kb, total: looks + hook };
};
