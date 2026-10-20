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
