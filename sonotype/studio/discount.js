// Discount codes without a checkout: a valid code shows the lower setup price
// on each offer, and the client says the code on the free call so it goes into
// their written plan. Payment is by bank transfer against an invoice.
// Codes are kept as SHA-256 hashes, so the list isn't readable in the page.
const CODES = {
  // LAUNCH10: 10% off the setup fee for launch clients.
  fc7218c3b41e41e928ab9e02140277dff6d2def5939f85f68f3a8cbffd32e154: { percent: 10 },
};

const euro = (n, lang) => `€${n.toLocaleString('en-GB').replace(/,/g, lang === 'bg' ? ' ' : ',')}`;

const WORDS = {
  en: {
    applied: (code, p) => `${code} applied: ${p}% off the setup fee. Say the code on your free call and it goes into your written plan. You pay by bank transfer.`,
    invalid: 'That code isn’t valid. Check the spelling, or ask us on the call.',
    empty: 'Type a code first.',
    price: (code, n) => `With ${code}: ${n} to build`,
  },
  bg: {
    applied: (code, p) => `${code} е приложен: ${p}% отстъпка от цената за изработка. Кажете кода на безплатния разговор и той влиза в писмения ви план. Плащате по банков път.`,
    invalid: 'Този код не е валиден. Проверете изписването или ни попитайте на разговора.',
    empty: 'Първо въведете код.',
    price: (code, n) => `С ${code}: ${n} за изработка`,
  },
};

async function hash(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function discount(section) {
  const form = section?.querySelector('.code');
  if (!form || !window.crypto?.subtle) return () => {};
  const input = form.querySelector('.code__input');
  const status = form.querySelector('.code__status');
  const offers = [...section.querySelectorAll('[data-offer]')];
  let state = null; // { kind: 'applied' | 'invalid' | 'empty', code, percent }

  const render = () => {
    const lang = document.documentElement.lang === 'bg' ? 'bg' : 'en';
    const w = WORDS[lang];
    offers.forEach((offer) => {
      let line = offer.querySelector('.offer__code');
      if (!line) {
        line = document.createElement('p');
        line.className = 'offer__code';
        line.setAttribute('data-i18n-skip', '');
        offer.querySelector('.offer__monthly')?.before(line);
      }
      if (state?.kind === 'applied') {
        const price = Number(offer.dataset.price);
        const after = Math.round(price * (1 - state.percent / 100));
        line.textContent = w.price(state.code, euro(after, lang));
        line.hidden = false;
      } else {
        line.hidden = true;
      }
    });
    status.textContent = !state ? '' : state.kind === 'applied' ? w.applied(state.code, state.percent) : w[state.kind];
    status.classList.toggle('is-ok', state?.kind === 'applied');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = input.value.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) {
      state = { kind: 'empty' };
    } else {
      const found = CODES[await hash(code)];
      state = found ? { kind: 'applied', code, percent: found.percent } : { kind: 'invalid' };
    }
    render();
  });

  return render;
}
