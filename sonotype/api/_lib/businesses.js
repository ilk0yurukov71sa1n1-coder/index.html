// The businesses whose bookings live in the studio database, and what
// "Clients who return" needs to know about each one. A real client gets its
// own entry: its booking link, its Google review link and how many days after
// each service a customer is usually ready to come back.
export const DEMO = {
  id: 'demo-salon',
  name: 'Salon Aurora',
  tz: 'Europe/Sofia',
  bookUrl: 'https://rollcfluence-shield.vercel.app/book',
  // The demo salon has no Google listing, so it never asks for reviews.
  reviewUrl: null,
  services: {
    'cut-women': { days: 42, bg: 'Дамско подстригване и оформяне', en: 'Women’s haircut and styling' },
    'cut-men': { days: 28, bg: 'Мъжко подстригване', en: 'Men’s haircut' },
    colour: { days: 42, bg: 'Боядисване на корени', en: 'Root colour' },
    'blow-dry': { days: null, bg: 'Сешоар', en: 'Blow-dry' },
    manicure: { days: 21, bg: 'Маникюр', en: 'Manicure' },
    'gel-nails': { days: 21, bg: 'Гел лак', en: 'Gel nails' },
  },
};

export const BUSINESSES = { [DEMO.id]: DEMO };
// Own keys only, so "constructor" or "__proto__" never count as a business.
export const businessById = (id) => (Object.hasOwn(BUSINESSES, String(id)) ? BUSINESSES[String(id)] : null);
