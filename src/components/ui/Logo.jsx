import { brand } from '../../config/site';

// Rollcfluence RC mark (white top, oxblood bottom) + name + product tag.
export default function Logo() {
  return (
    <span className="logo">
      <img className="logo__mark" src="/logo-rc.svg" alt="" width="30" height="30" decoding="async" />
      <span className="logo__name">{brand.name.toLowerCase()}</span>
      <span className="logo__tag">{brand.product}</span>
    </span>
  );
}
