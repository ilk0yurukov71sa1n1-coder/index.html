// Vercel's published unit prices, used by Bill Guard and the free bill check.
// Plain ESM with no Node imports, so the browser page can use the same table.
// Checked 25 October 2026 against these pages (USD, excluding VAT):
//   https://vercel.com/docs/functions/usage-and-pricing      (invocations, Hobby allowances, region rates)
//   https://vercel.com/docs/pricing/regional-pricing/iad1     (and /fra1 etc.: CDN requests, data transfer)
//   https://vercel.com/docs/plans/pro-plan                    ($20 fee, $20 credit, Flat Rate CDN tier)
//   https://vercel.com/docs/functions/limitations             (default 2 GB / 1 vCPU)
export const PRICES_CHECKED = '2026-10-25';
export const PRICE_SOURCES = [
  'https://vercel.com/docs/functions/usage-and-pricing',
  'https://vercel.com/docs/pricing/regional-pricing',
  'https://vercel.com/docs/plans/pro-plan',
];

// Per region: Active CPU $/hour, Provisioned Memory $/GB-hour, CDN requests $/1M, Fast Data Transfer $/GB.
// cpu and mem are from the functions pricing table; cdn and gb only for regions whose page we read.
export const REGIONS = {
  iad1: { name: 'Washington D.C., USA', cpu: 0.128, mem: 0.0106, cdn: 2.0, gb: 0.15 },
  fra1: { name: 'Frankfurt, Germany', cpu: 0.184, mem: 0.0152, cdn: 2.6, gb: 0.15 },
  cdg1: { name: 'Paris, France', cpu: 0.177, mem: 0.0146 },
  dub1: { name: 'Dublin, Ireland', cpu: 0.168, mem: 0.0139 },
  lhr1: { name: 'London, UK', cpu: 0.177, mem: 0.0146 },
  arn1: { name: 'Stockholm, Sweden', cpu: 0.16, mem: 0.0133 },
  sfo1: { name: 'San Francisco, USA', cpu: 0.177, mem: 0.0147 },
  sin1: { name: 'Singapore', cpu: 0.16, mem: 0.0133 },
};
export const DEFAULT_REGION = 'iad1'; // Vercel's default function region

export const INVOCATION_PER_M = 0.6; // $ per 1M function invocations (Pro, on demand)
export const PRO = { fee: 20, credit: 20, cdnRequests: 1_000_000, transferGb: 1000 }; // Flat Rate CDN lowest tier
export const HOBBY = { cpuHours: 4, memGbHours: 360, invocations: 1_000_000, cdnRequests: 1_000_000, transferGb: 100 };
export const DEFAULT_MEMORY_GB = 2;

// Regions whose CDN page we did not read use the iad1 rates (the lowest), marked as such.
const cdnRates = (r) => (REGIONS[r]?.cdn != null ? { cdn: REGIONS[r].cdn, gb: REGIONS[r].gb, cdnAssumed: false } : { cdn: REGIONS.iad1.cdn, gb: REGIONS.iad1.gb, cdnAssumed: true });

const round = (n) => Math.round(n * 100) / 100;

// A monthly estimate from traffic numbers. Everything is an upper bound for compute:
// memory is counted for the whole request time as if each request had its own
// instance, and CPU is counted for the whole request time unless cpuMs is given.
// Fluid compute shares instances between requests, so the real bill is usually lower.
//   requests      function requests a month
//   avgMs         average request time in ms
//   cpuMs         average busy CPU time in ms, if known
//   memoryGb      function memory (default 2)
//   pageViews     CDN requests a month (static pages, images, assets), default = requests
//   kbPerRequest  average response size in KB
export const estimateMonth = ({ requests = 0, avgMs = 0, cpuMs = null, memoryGb = DEFAULT_MEMORY_GB, cdnRequests = null, kbPerRequest = 0, region = DEFAULT_REGION } = {}) => {
  const reg = REGIONS[region] ? region : DEFAULT_REGION;
  const rate = REGIONS[reg];
  const cdnRate = cdnRates(reg);
  const n = Math.max(0, Number(requests) || 0);
  const ms = Math.max(0, Number(avgMs) || 0);
  const cpu = cpuMs == null ? ms : Math.min(ms, Math.max(0, Number(cpuMs) || 0));
  const mem = Math.min(4, Math.max(0.5, Number(memoryGb) || DEFAULT_MEMORY_GB));
  const cdnN = cdnRequests == null ? n : Math.max(0, Number(cdnRequests) || 0);
  const gb = (n * Math.max(0, Number(kbPerRequest) || 0)) / 1_000_000;

  const usage = {
    invocations: n,
    cpuHours: (n * cpu) / 3_600_000,
    memGbHours: (n * ms * mem) / 3_600_000,
    cdnRequests: cdnN,
    transferGb: gb,
  };
  // Pro: every unit costs from the first one, the $20 credit pays the first $20,
  // CDN requests and transfer inside the Flat Rate tier are included.
  const lines = {
    invocations: (usage.invocations / 1_000_000) * INVOCATION_PER_M,
    cpu: usage.cpuHours * rate.cpu,
    memory: usage.memGbHours * rate.mem,
    cdn: (Math.max(0, usage.cdnRequests - PRO.cdnRequests) / 1_000_000) * cdnRate.cdn,
    transfer: Math.max(0, usage.transferGb - PRO.transferGb) * cdnRate.gb,
  };
  const usageUsd = Object.values(lines).reduce((a, b) => a + b, 0);
  const overCredit = Math.max(0, usageUsd - PRO.credit);
  // Hobby: free inside the allowances, and the project is paused past them, never billed.
  const hobbyOver = Object.entries({
    invocations: usage.invocations / HOBBY.invocations,
    cpuHours: usage.cpuHours / HOBBY.cpuHours,
    memGbHours: usage.memGbHours / HOBBY.memGbHours,
    cdnRequests: usage.cdnRequests / HOBBY.cdnRequests,
    transferGb: usage.transferGb / HOBBY.transferGb,
  })
    .filter(([, share]) => share > 1)
    .map(([k]) => k);

  return {
    region: reg,
    cdnAssumed: cdnRate.cdnAssumed,
    usage,
    lines: Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, round(v)])),
    pro: { usage: round(usageUsd), total: round(PRO.fee + overCredit) },
    hobby: { fits: hobbyOver.length === 0, over: hobbyOver },
  };
};

// Cost of a counted set of requests (Bill Guard): the same rates, no credit, no allowances.
export const costOf = ({ requests = 0, totalMs = 0, cpuMs = null, memoryGb = DEFAULT_MEMORY_GB, region = DEFAULT_REGION }) => {
  const rate = REGIONS[region] || REGIONS[DEFAULT_REGION];
  const cpuTotal = cpuMs == null ? totalMs : Math.min(totalMs, cpuMs);
  return (requests / 1_000_000) * INVOCATION_PER_M + (cpuTotal / 3_600_000) * rate.cpu + ((totalMs * memoryGb) / 3_600_000) * rate.mem;
};
