export default function Logo({ size = 32, dark = false }: { size?: number; dark?: boolean }) {
  const stroke = dark ? '#000' : '#fff'
  const accent = '#22c55e'

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer orbit ring */}
      <ellipse
        cx="18" cy="18" rx="15" ry="6"
        stroke={stroke} strokeWidth="1.5" fill="none" opacity="0.4"
        transform="rotate(-35 18 18)"
      />
      {/* Middle orbit ring */}
      <ellipse
        cx="18" cy="18" rx="10" ry="4"
        stroke={accent} strokeWidth="1.8" fill="none"
        transform="rotate(25 18 18)"
      />
      {/* Center star */}
      <circle cx="18" cy="18" r="3.5" fill={stroke} />
      {/* Orbiting dot on accent ring */}
      <circle cx="26" cy="15" r="2" fill={accent} />
    </svg>
  )
}
