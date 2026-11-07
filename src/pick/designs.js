// What a client can pick on /pick. Each design has a package level:
//   1 Signature (ready-made styles in the client's colours), 2 Concierge, 3 Flagship (custom-made for the brand), 4 Atelier (made from scratch).
// `lab` is the id of the same design in the private playground, so the client can open and try it live.
// ilko decides which level each one belongs to: change `level` here and the page recalculates.
export const GROUPS = ['background', 'buttons', 'text', 'motion'];

export const DESIGNS = [
  { id: 'fibers', group: 'background', level: 3, lab: 'site', bg: ['Копринени нишки', 'Меки нишки в цветовете на вашата марка, които реагират леко на мишката.'], en: ['Silk fibres', 'Soft threads in your brand colours that react gently to the mouse.'] },
  { id: 'lines', group: 'background', level: 3, lab: 'book-waves', bg: ['Течащи линии', 'Фини вълнообразни линии зад съдържанието.'], en: ['Flowing lines', 'Fine wavy lines behind the content.'] },
  { id: 'liquid', group: 'background', level: 3, lab: 'cost', bg: ['Тъмна течност', 'Тъмна лента с течен метал, която се движи.'], en: ['Dark liquid', 'A dark band with moving liquid metal.'] },
  { id: 'drift', group: 'background', level: 3, lab: 'drift-wall', bg: ['Плаваща стена от снимки', 'Вашите снимки или услуги като наклонена стена, която бавно се движи.'], en: ['Drifting photo wall', 'Your photos or services as a tilted wall that slowly moves.'] },
  { id: 'clouds', group: 'background', level: 4, lab: 'cloud-code', bg: ['Облаци към код', 'Падате през облаци към ред от код при превъртане.'], en: ['Clouds into code', 'Scrolling takes you through clouds into lines of code.'] },
  { id: 'rip', group: 'background', level: 4, lab: 'rip-through', bg: ['Страница, която се къса', 'Картина, която се разкъсва при превъртане и разкрива нещо.'], en: ['Page that tears open', 'A picture that rips open as you scroll and shows something.'] },

  { id: 'btn-ready', group: 'buttons', level: 1, lab: 'all-buttons', bg: ['Готови бутони', 'Строги бутони в 8 стила (тъмен, мек, стъклен, редакционен и други) във вашите цветове.'], en: ['Ready-made buttons', 'Clean buttons in 8 styles (dark, soft, glass, editorial and more) in your colours.'] },
  { id: 'btn-motion', group: 'buttons', level: 3, lab: 'all-buttons', bg: ['Бутони с движение', 'Бутони, които реагират на докосване: пълнене, морфиране, 3D и мастило.'], en: ['Buttons with motion', 'Buttons that react to touch: fill, morph, 3D and ink.'] },

  { id: 'text-rise', group: 'text', level: 1, lab: 'text-motion-lab', bg: ['Заглавия, които се появяват', 'Думите на заглавията се появяват една по една.'], en: ['Headings that rise', 'Heading words appear one by one.'] },
  { id: 'text-custom', group: 'text', level: 3, lab: 'text-styles', bg: ['Текстови ефекти по мярка', 'Избран от 16 стила текстов ефект, настроен към вашата марка.'], en: ['Custom text effects', 'One of 16 text styles, tuned to your brand.'] },

  { id: 'photo', group: 'motion', level: 3, lab: 'photo-reveal', bg: ['Отваряне на снимки', 'Осем начина да се отвори снимка в 3D.'], en: ['Photo reveals', 'Eight ways to open a photo in 3D.'] },
  { id: 'transitions', group: 'motion', level: 3, lab: 'transition-lab', bg: ['Преходи между страници', 'Плавен преход при смяна на страница.'], en: ['Page transitions', 'A smooth change when moving between pages.'] },
  { id: 'expand', group: 'motion', level: 3, lab: 'scroll-expand', bg: ['Разширяваща се снимка', 'Рамка, която се отваря до цял екран при превъртане.'], en: ['Expanding picture', 'A frame that opens to full screen as you scroll.'] },
  { id: 'carousel', group: 'motion', level: 3, lab: 'flex-carousel', bg: ['Лента със снимки', 'Снимки, наредени като карти, които се разместват.'], en: ['Picture carousel', 'Pictures laid out as cards that slide past each other.'] },
  { id: 'panel', group: 'motion', level: 3, lab: 'file-pop-panel', bg: ['Изскачащ панел', 'Карта, която се отваря в панел с подробности.'], en: ['Pop-up panel', 'A card that opens into a panel with details.'] },
];

// Things that cost extra, with the prices from the services page.
export const ADDONS = [
  { id: 'page', price: 120, bg: 'Допълнителна страница', en: 'Extra page', each: true },
  { id: 'language', price: 90, bg: 'Допълнителен език', en: 'Extra language', each: true },
  { id: 'google', price: 60, bg: 'Google профил на бизнеса', en: 'Google Business profile', includedAt: 3 },
  { id: 'brand', price: 240, bg: 'Брандкит (лого и цветове)', en: 'Brand kit (logo and colours)' },
];

// What is not built on client pages (ilko's own rules), said plainly.
export const NOT_BUILT = {
  bg: ['Анимации, които следват курсора', 'Лилави преливащи фонове', 'Фалшиви броячи, оценки и отзиви', 'Картини, направени с изкуствен интелект', 'AI асистент и онлайн резервации (в момента: бутони за обаждане и SMS)'],
  en: ['Cursor-following animations', 'Purple gradient backgrounds', 'Fake counters, ratings or reviews', 'Pictures made with AI', 'An AI assistant and online booking (for now: call and SMS buttons)'],
};
