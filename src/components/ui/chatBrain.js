// The chat helper's built-in answer engine (no AI, no network).
// Every known answer is indexed by its question, its keywords and its text,
// in the page language and in English, so "кога", "Preis" or "pricing" all
// find the right answer. Words are cut to a short stem so plurals and
// inflections still match.

const STOP = new Set(
  (
    'the a an is it do does i my you your to of and or in on for can what how with be are if me we that there work works use using get have has will would should could about any ' +
    'и на в за да се с от по ли как какво какъв колко ми ви ние вие това е са ако или ' +
    'der die das ist und oder ich du sie wir mit für von zu ein eine wie was kann ' +
    'le la les est et ou je vous nous avec pour de des un une comment que quoi ' +
    'el la los las es y o yo tu con para de del un una como que'
  ).split(' ')
);

const stem = (w) => (w.length > 5 ? w.slice(0, 5) : w);

export const words = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((w) => w.length > 1 && !STOP.has(w)) ?? [];

const stems = (text) => new Set(words(text).map(stem));

// entries: [{ q, a, keys: [], en: { q, a, keys } }]
export const makeBrain = (entries) => {
  const docs = entries.map((e) => {
    const title = new Set([...stems(e.q), ...stems((e.keys || []).join(' ')), ...stems(e.en?.q || ''), ...stems((e.en?.keys || []).join(' '))]);
    const body = new Set([...stems(e.a), ...stems(e.en?.a || '')]);
    return { e, title, body };
  });
  // Rarer words count for more: "vat" says more than "plan".
  const df = new Map();
  for (const d of docs) for (const s of new Set([...d.title, ...d.body])) df.set(s, (df.get(s) || 0) + 1);
  const idf = (s) => Math.log(1 + docs.length / (df.get(s) || docs.length));

  const rank = (text) => {
    const asked = [...stems(text)];
    if (!asked.length) return [];
    return docs
      .map((d) => {
        let score = 0;
        for (const s of asked) score += d.title.has(s) ? 2 * idf(s) : d.body.has(s) ? 0.6 * idf(s) : 0;
        return { entry: d.e, score };
      })
      .filter((r) => r.score > 0)
      .sort((x, y) => y.score - x.score);
  };

  // The best answer when it is clearly good enough, plus up to two related
  // questions. When two answers score about the same, ask which one was meant.
  const ask = (text) => {
    const ranked = rank(text);
    const top = ranked[0];
    const unsure = ranked[1] && ranked[1].score >= top.score * 0.9;
    const answer = top && top.score >= 1.6 && !unsure ? top.entry : null;
    const related = ranked
      .slice(answer ? 1 : 0)
      .filter((r) => r.score >= (top?.score || 0) * 0.6)
      .slice(0, answer ? 2 : 3)
      .map((r) => r.entry);
    return { answer, related, unsure: Boolean(unsure && top.score >= 1.6) };
  };

  return { ask, rank };
};
