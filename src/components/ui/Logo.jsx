import { brand } from '../../config/site';

// Rollcfluence wordmark: shield mark + name + product tag.
export default function Logo() {
  return (
    <span className="logo">
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M16 4.5l9.5 3.7v7.5c0 5.9-4.1 10.1-9.5 11.8-5.4-1.7-9.5-5.9-9.5-11.8V8.2L16 4.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M11.5 16.4l3.2 3.2 6-6.6" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="logo__name">{brand.name.toLowerCase()}</span>
      <span className="logo__tag">{brand.product}</span>
    </span>
  );
}
