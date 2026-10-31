// Plans and their monthly allowances. Prices are in euro cents, excluding VAT.
// No imports, so the dashboard can share it.
export const PLANS = {
  starter: { name: 'Starter', cents: 0, requests: 10_000, keys: 2 },
  pro: { name: 'Pro', cents: 4900, requests: 200_000, keys: 20 },
  team: { name: 'Team', cents: 29900, requests: 1_250_000, keys: 20 },
  scale: { name: 'Scale', cents: 79900, requests: 3_500_000, keys: 20 },
  business: { name: 'Business', cents: null, requests: null, keys: 20 },
};
export const PAID = ['pro', 'team', 'scale'];
