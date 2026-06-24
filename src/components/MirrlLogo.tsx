export function MirrlLogo({ size = 26, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={spin ? "animate-spin-slow" : ""}
      aria-hidden
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x="11.1"
          y="1.2"
          width="1.8"
          height="6.4"
          rx="0.9"
          fill="currentColor"
          opacity={0.55 + (i % 3) * 0.15}
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}
