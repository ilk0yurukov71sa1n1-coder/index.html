// "Take more, pay less": the savings are worked out here from the prices on
// the page itself (each offer card carries its price), so they can never
// drift from what the offers say. Design add-on prices sit on the section.
// Written like the offer prices above: €1,190 in English, €1 190 in Bulgarian.
const euro = (n, lang) => `€${n.toLocaleString('en-GB').replace(/,/g, lang === 'bg' ? ' ' : ',')}`;

export default function deals(root) {
  const offers = Object.fromEntries(
    [...document.querySelectorAll('[data-offer]')].map((el) => [
      el.dataset.offer,
      { price: Number(el.dataset.price), monthly: Number(el.dataset.monthly) },
    ]),
  );
  const { page, assistant, both } = offers;
  const d = root.dataset;
  const kitApart = Number(d.logo) + Number(d.profiles) + Number(d.poster);
  const kit = Number(d.kit);
  if (![page, assistant, both].every(Boolean) || ![kitApart, kit].every(Number.isFinite)) return null;

  const list = {
    pair: { apart: page.price + assistant.price, apartMonthly: page.monthly + assistant.monthly, together: both.price, monthly: both.monthly },
    kit: { apart: kitApart, together: kit },
    everything: { apart: page.price + assistant.price + kitApart, apartMonthly: page.monthly + assistant.monthly, together: both.price + kit, monthly: both.monthly },
  };

  const words = {
    en: { setup: 'at setup', once: 'one-off', month: 'a month' },
    bg: { setup: 'за изработка', once: 'еднократно', month: 'на месец' },
  };

  const render = () => {
    const lang = document.documentElement.lang === 'bg' ? 'bg' : 'en';
    const w = words[lang];
    root.querySelectorAll('[data-deal]').forEach((card) => {
      const x = list[card.dataset.deal];
      if (!x) return;
      const yearly = x.monthly ? (x.apartMonthly - x.monthly) * 12 : 0;
      const set = (key, text) => {
        const el = card.querySelector(`[data-n="${key}"]`);
        if (el) el.textContent = text;
      };
      set('save', euro(x.apart - x.together, lang));
      set('saveYear', yearly ? `+ ${euro(yearly, lang)}` : '');
      set('apart', `${euro(x.apart, lang)} ${x.monthly ? w.setup : w.once}`);
      set('together', `${euro(x.together, lang)} ${x.monthly ? w.setup : w.once}`);
      set('apartMonthly', x.monthly ? `+ ${euro(x.apartMonthly, lang)} ${w.month}` : '');
      set('monthly', x.monthly ? `+ ${euro(x.monthly, lang)} ${w.month}` : '');
      card.querySelectorAll('[data-show="yearly"]').forEach((el) => {
        el.hidden = !yearly;
      });
    });
  };
  render();
  return render;
}
