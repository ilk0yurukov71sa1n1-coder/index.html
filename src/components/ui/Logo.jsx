import { brand } from '../../config/site';
import TextScanner from './TextScanner';

// Rollcfluence RC mark (white top, oxblood bottom) + name + product tag.
export default function Logo() {
  return (
    <span className="logo">
      <img className="logo__mark" src="/logo-rc.png" alt="" width="36" height="36" decoding="async" />
      <TextScanner className="logo__name" text={brand.name.toLowerCase()} />
      <span className="logo__tag">{brand.product}</span>
    </span>
  );
}
