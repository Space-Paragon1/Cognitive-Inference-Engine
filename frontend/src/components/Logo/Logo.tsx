/** The CLR mark: a hub and five nodes, in the accent colour. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="14 14 80 80" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--accent)" strokeOpacity=".55" strokeWidth="3.5" strokeLinecap="round">
        <path d="M54 47V31M47 54H31M61 54h16M49 59 37 72M59 59l12 13" />
      </g>
      <g fill="var(--accent)">
        <circle cx="54" cy="54" r="7" />
        <circle cx="54" cy="25" r="5" />
        <circle cx="25" cy="54" r="5" />
        <circle cx="83" cy="54" r="5" />
        <circle cx="33" cy="77" r="5" />
        <circle cx="75" cy="77" r="5" />
      </g>
    </svg>
  );
}
