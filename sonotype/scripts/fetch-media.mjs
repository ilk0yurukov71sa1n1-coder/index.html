// Downloads the SONOTYPE public media into public/media before a build.
// Fails loudly instead of substituting other files.
import { mkdir, writeFile, stat } from 'node:fs/promises';

const BASE = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663228113460/';
const FILES = {
  'sonotype-cinematic-story.mp4': 'LDssTihFFejbJtjB.mp4',
  'sonotype-cinematic-poster.webp': 'FkyXAAQuKYAhLNAn.webp',
  'sonotype-tidal-social.webp': 'YxTHSBgvuMSoKgLF.webp',
  'sonotype-tidal-mark.svg': 'RTxLnauqrkEeVPuU.svg',
};
const dir = new URL('../public/media/', import.meta.url);
await mkdir(dir, { recursive: true });

for (const [name, remote] of Object.entries(FILES)) {
  const target = new URL(name, dir);
  try {
    if ((await stat(target)).size > 0) { console.log(`ok (cached) ${name}`); continue; }
  } catch {}
  const res = await fetch(BASE + remote);
  if (!res.ok) throw new Error(`Could not retrieve ${name} (${res.status} from ${BASE + remote})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(target, buf);
  console.log(`ok ${name} ${buf.length} bytes`);
}

// Studio: the walking-crowd sprite (from 21st.dev) is copied onto our own server
// at build time, so visitors' browsers never contact cdn.21st.dev.
// Required on Vercel; only a warning on a machine that cannot reach the CDN.
{
  const url = 'https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png';
  const target = new URL('../public/studio/crowd-sprite.png', import.meta.url);
  let cached = false;
  try { cached = (await stat(target)).size > 0; } catch {}
  if (cached) console.log('ok (cached) crowd-sprite.png');
  else {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error('not a PNG');
      await writeFile(target, buf);
      console.log(`ok crowd-sprite.png ${buf.length} bytes`);
    } catch (e) {
      if (process.env.VERCEL) throw new Error(`Could not retrieve crowd sprite: ${e.message}`);
      console.warn(`warn: crowd sprite not fetched here (${e.message}); the Vercel build fetches it`);
    }
  }
}
