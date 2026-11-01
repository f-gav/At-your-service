export function SiteLogo() {
  return (
    <span className="brand-wrap" aria-label="At your service!">
      <img className="brand-icon" src={`${import.meta.env.BASE_URL}site-icon.png`} alt="" aria-hidden="true" />
      <img className="brand-wordmark" src={`${import.meta.env.BASE_URL}wordmark.svg`} alt="At your service!" />
    </span>
  );
}

/** Decorative silhouette from the approved homepage mockup. */
export function HeroEmblem() {
  return (
    <svg className="hero-emblem" viewBox="0 0 324 118" aria-hidden="true" focusable="false">
      <path d="M162 2 181 14H143Z" />
      <path d="M105 18h114c16 0 29 13 29 29v47H76V47c0-16 13-29 29-29Z" />
      <path d="M65 80h194c9 0 16 7 16 16v2H49v-2c0-9 7-16 16-16Z" />
      <path d="M0 100h324l-28 17H28Z" />
    </svg>
  );
}

