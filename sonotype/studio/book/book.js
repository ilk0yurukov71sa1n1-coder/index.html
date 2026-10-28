// The booking page for the demo salon. Reads free times from /api/book and
// posts the request there. The rules (which times exist) are the same file
// the server checks with, so the page never offers a time the server refuses.
import { DEMO, freeSlots, toTime } from '../../api/_lib/booking.js';

const T = {
  bg: {
    title: 'Запазете час за минута.', eyebrow: 'Онлайн записване', lead: 'Изберете услуга, ден и час. Ще ви се обадим, за да потвърдим.',
    demo: 'Демо: примерен салон, направен от Rollcfluence. Заявките идват при нас, не при истински салон.', demoLink: 'Искам такава страница',
    s1: 'Услуга', s2: 'Ден', s3: 'Час', s4: 'Вашите данни', min: 'мин', closed: 'почивка',
    pickService: 'Първо изберете услуга и ден.', noTimes: 'Няма свободни часове в този ден. Изберете друг ден.',
    name: 'Име', phone: 'Телефон', email: 'Имейл (по желание: потвърждение и напомняне ден преди часа)', note: 'Бележка (по желание)',
    consent: 'Пратете ми молба за отзив след посещението и напомняне, когато е време за следващия час. Мога да ги спра с един клик.',
    summary: 'Вашият час', submit: 'Запазете час', sending: 'Изпращане…',
    privacy: 'Използваме данните ви само за този час и тези имейли. Изтриват се 90 дни след часа.', privacyLink: 'Поверителност',
    doneTitle: 'Заявката е изпратена.', doneText: 'Ще ви се обадим, за да потвърдим часа.', doneMailed: 'Изпратихме ви и имейл с детайлите.', again: 'Запазете още един час',
    errors: { invalid_name: 'Моля, напишете името си.', invalid_phone: 'Моля, проверете телефона.', invalid_email: 'Моля, проверете имейла или го оставете празен.', slot_taken: 'Някой току-що взе този час. Изберете друг.', too_many_requests: 'Днес вече има няколко заявки с този телефон или имейл. Моля, обадете се.', online_closed: 'Онлайн записването е затворено за днес. Моля, обадете се.', invalid_time: 'Този час вече не е свободен. Изберете друг.', load: 'Записването не можа да се зареди. Опреснете страницата.', other: 'Нещо се обърка. Опитайте отново.' },
    locale: 'bg-BG', docTitle: 'Запазете час · Salon Aurora (демо)',
  },
  en: {
    title: 'Book your visit in a minute.', eyebrow: 'Online booking', lead: 'Pick a service, a day and a time. We will call you to confirm.',
    demo: 'Demo: a sample salon built by Rollcfluence. Requests come to us, not to a real salon.', demoLink: 'I want a page like this',
    s1: 'Service', s2: 'Day', s3: 'Time', s4: 'Your details', min: 'min', closed: 'closed',
    pickService: 'Pick a service and a day first.', noTimes: 'No free times on this day. Please pick another day.',
    name: 'Name', phone: 'Phone', email: 'Email (optional: a receipt and a reminder the day before)', note: 'Note (optional)',
    consent: 'Send me a review request after my visit and a reminder when it is time for the next one. I can stop them with one click.',
    summary: 'Your visit', submit: 'Book this time', sending: 'Sending…',
    privacy: 'We use your details only for this visit and these emails. They are deleted 90 days after it.', privacyLink: 'Privacy',
    doneTitle: 'Your request is in.', doneText: 'We will call you to confirm the time.', doneMailed: 'We also sent you an email with the details.', again: 'Book another visit',
    errors: { invalid_name: 'Please write your name.', invalid_phone: 'Please check your phone number.', invalid_email: 'Please check your email or leave it empty.', slot_taken: 'Someone just took this time. Please pick another.', too_many_requests: 'There are already several requests with this phone or email today. Please call.', online_closed: 'Online booking is closed for today. Please call.', invalid_time: 'This time is no longer available. Please pick another.', load: 'Booking could not load. Please refresh the page.', other: 'Something went wrong. Please try again.' },
    locale: 'en-GB', docTitle: 'Book a visit · Salon Aurora (demo)',
  },
};

const $ = (s) => document.querySelector(s);
const form = $('.bk-form');
const state = { lang: 'bg', service: null, day: null, time: null, days: [], busy: [] };
try { if (localStorage.getItem('rc-lang') === 'en') state.lang = 'en'; } catch {}
const t = () => T[state.lang];

function words() {
  document.documentElement.lang = state.lang;
  document.title = t().docTitle;
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t()[el.dataset.t]; });
  document.querySelectorAll('.bk-lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
}

function services() {
  const box = $('.bk-services');
  box.textContent = '';
  for (const s of DEMO.services) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bk-service';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(state.service === s.id));
    b.innerHTML = '<span class="bk-service__name"></span><span class="bk-service__meta"></span>';
    b.querySelector('.bk-service__name').textContent = s[state.lang];
    b.querySelector('.bk-service__meta').textContent = `${s.min} ${t().min} · €${s.eur}`;
    b.addEventListener('click', () => { state.service = s.id; state.time = null; render(); });
    box.append(b);
  }
}

function days() {
  const box = $('.bk-days');
  box.textContent = '';
  const fmtW = new Intl.DateTimeFormat(t().locale, { weekday: 'short', timeZone: 'UTC' });
  const fmtD = new Intl.DateTimeFormat(t().locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  for (const d of state.days) {
    const at = new Date(`${d.day}T12:00:00Z`);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bk-day';
    b.disabled = !d.open;
    b.setAttribute('aria-pressed', String(state.day === d.day));
    b.innerHTML = '<span class="bk-day__w"></span><span class="bk-day__d"></span>';
    b.querySelector('.bk-day__w').textContent = d.open ? fmtW.format(at) : t().closed;
    b.querySelector('.bk-day__d').textContent = fmtD.format(at);
    b.addEventListener('click', () => { state.day = d.day; state.time = null; render(); });
    box.append(b);
  }
}

function times() {
  const box = $('.bk-times');
  box.textContent = '';
  const hint = (key) => { const p = document.createElement('p'); p.className = 'bk-hint'; p.textContent = t()[key]; box.append(p); };
  if (!state.service || !state.day) return hint('pickService');
  const busy = state.busy.filter((b) => b.day === state.day);
  const list = freeSlots(DEMO, { day: state.day, service: state.service, busy });
  if (!list.length) return hint('noTimes');
  for (const time of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bk-time';
    b.textContent = time;
    b.setAttribute('aria-pressed', String(state.time === time));
    b.addEventListener('click', () => { state.time = time; render(); });
    box.append(b);
  }
}

function summary() {
  const box = $('.bk-summary');
  const svc = DEMO.services.find((s) => s.id === state.service);
  const ready = svc && state.day && state.time;
  box.hidden = !ready;
  if (ready) {
    const at = new Date(`${state.day}T12:00:00Z`);
    const when = new Intl.DateTimeFormat(t().locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(at);
    $('.bk-summary__text').textContent = `${svc[state.lang]}, ${when}, ${state.time}`;
  }
  $('.bk-submit').disabled = !ready;
}

function render() {
  words();
  services();
  days();
  times();
  summary();
}

// Consent only makes sense with an email to send to.
form.email.addEventListener('input', () => {
  const has = form.email.value.trim().length > 3;
  form.consent.disabled = !has;
  if (!has) form.consent.checked = false;
});

document.querySelectorAll('.bk-lang button').forEach((b) =>
  b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    try { localStorage.setItem('rc-lang', state.lang); } catch {}
    render();
  }),
);

async function load() {
  try {
    const r = await fetch(`/api/book?business=${DEMO.id}`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    state.days = data.days;
    state.busy = data.busy;
    if (!state.day) state.day = data.days.find((d) => d.open)?.day || null;
  } catch {
    $('.bk-error').textContent = t().errors.load;
  }
  render();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('.bk-submit');
  const err = $('.bk-error');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = t().sending;
  try {
    const r = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business: DEMO.id, service: state.service, day: state.day, time: state.time,
        name: form.name.value, phone: form.phone.value, email: form.email.value, note: form.note.value,
        consent: form.consent.checked, lang: state.lang, hp_note2: form.hp_note2.value,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      err.textContent = t().errors[data.error] || t().errors.other;
      if (data.error === 'slot_taken' || data.error === 'invalid_time') { state.time = null; await load(); }
      return;
    }
    form.hidden = true;
    $('.bk-done').hidden = false;
    $('.bk-done__mailed').hidden = !data.mailed;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    err.textContent = t().errors.other;
  } finally {
    btn.textContent = t().submit;
    summary();
  }
});

$('.bk-again').addEventListener('click', () => {
  form.reset();
  form.consent.disabled = true;
  state.time = null;
  form.hidden = false;
  $('.bk-done').hidden = true;
  load();
});

render();
load();
