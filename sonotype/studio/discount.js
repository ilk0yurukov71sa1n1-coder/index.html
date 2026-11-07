// Discount codes without a checkout: a valid code shows the lower prices on
// each offer, and the client says the code on the free call so it goes into
// their written plan. Payment is by bank transfer against an invoice.
// Codes are kept as SHA-256 hashes, so the list isn't readable in the page.
const CODES = {
  // 6ROLLCU: 6% off everything (setup, monthly fee and add-ons). ilko, 2026-10-24.
  '216fc8d88f16c7627b46a2f961e55d13d324811b9f4c85f2d7025cc1e6832107': { percent: 6 },
};

// €1,190 and €36.66 in English, €1 190 and €36,66 in Bulgarian.
const euro = (n, lang) => {
  const s = n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `€${lang === 'bg' ? s.replace(/,/g, ' ').replace('.', ',') : s}`;
};

const WORDS = {
  en: {
    applied: (code, p) => `${code} applied: you have ${p}% off everything, the setup, the monthly fee and every add-on. Say the code on your free call and it goes into your written plan. You pay by bank transfer.`,
    invalid: 'That code isn’t valid. Check the spelling, or ask us on the call.',
    empty: 'Type a code first.',
    price: (code, n, m) => `With ${code}: ${n} to build, then ${m} a month`,
  },
  bg: {
    applied: (code, p) => `${code} е приложен: имате ${p}% отстъпка от всичко, от изработката, месечната такса и всяка добавка. Кажете кода на безплатния разговор и той влиза в писмения ви план. Плащате по банков път.`,
    invalid: 'Този код не е валиден. Проверете изписването или ни попитайте на разговора.',
    empty: 'Първо въведете код.',
    price: (code, n, m) => `С ${code}: ${n} за изработка, после ${m} на месец`,
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
        const monthly = Number(offer.dataset.monthly);
        const after = Math.round(price * (1 - state.percent / 100));
        const afterMonthly = Math.round(monthly * (1 - state.percent / 100) * 100) / 100;
        line.textContent = w.price(state.code, euro(after, lang), euro(afterMonthly, lang));
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
