// The businesses whose bookings live in the studio database. A real client
// gets its own entry: hours, services and prices for its booking page, its
// Google review link, and how many days after each service a customer is
// usually ready to come back ("back"; null = never sent a reminder to return).
// No Node imports here, so the booking page can use it too.
export const DEMO = {
  id: 'demo-salon',
  name: 'Salon Aurora',
  tz: 'Europe/Sofia',
  bookUrl: 'https://rollcfluence.vercel.app/studio/book/',
  // The demo salon has no Google listing, so it never asks for reviews.
  reviewUrl: null,
  step: 30, // minutes between start times
  leadMin: 120, // earliest booking: 2 hours from now
  days: 21, // how far ahead people can book
  // Minutes from midnight, by weekday (0 = Sunday, closed).
  hours: { 1: [540, 1140], 2: [540, 1140], 3: [540, 1140], 4: [540, 1140], 5: [540, 1140], 6: [600, 960] },
  services: [
    { id: 'cut-women', min: 60, eur: 35, back: 42, bg: 'Дамско подстригване и оформяне', en: 'Women’s haircut and styling' },
    { id: 'cut-men', min: 30, eur: 18, back: 28, bg: 'Мъжко подстригване', en: 'Men’s haircut' },
    { id: 'colour', min: 90, eur: 55, back: 42, bg: 'Боядисване на корени', en: 'Root colour' },
    { id: 'blow-dry', min: 30, eur: 20, back: null, bg: 'Сешоар', en: 'Blow-dry' },
    { id: 'manicure', min: 45, eur: 22, back: 21, bg: 'Маникюр', en: 'Manicure' },
    { id: 'gel-nails', min: 60, eur: 30, back: 21, bg: 'Гел лак', en: 'Gel nails' },
  ],
};

export const BUSINESSES = { [DEMO.id]: DEMO };
// Own keys only, so "constructor" or "__proto__" never count as a business.
export const businessById = (id) => (Object.hasOwn(BUSINESSES, String(id)) ? BUSINESSES[String(id)] : null);
export const serviceOf = (biz, id) => biz.services.find((s) => s.id === id) || null;
