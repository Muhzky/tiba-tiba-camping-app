import { Link } from '@tanstack/react-router'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center ${className ?? ''}`} aria-label="Tiba Tiba Camping — beranda">
      <img
        src="/images/logo-ttc.png"
        alt="Tiba Tiba Camping"
        width={107}
        height={100}
        className="h-11 w-auto"
      />
    </Link>
  )
}
