import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * Avatar Stisla (`.avatar`) dengan foto profil.
 *
 * Foto baru diungkap lewat `data-status="loaded"` setelah `onLoad` (pola yang
 * didokumentasikan `@stisla/style`), sehingga fallback inisial tetap terlihat
 * selama foto dimuat — dan tetap tampil bila URL-nya rusak.
 */
export function AdminAvatar({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string | null
  alt: string
  fallback: ReactNode
  className?: string
}) {
  // Dipakai sebagai kunci: saat `src` berganti, foto lama tidak ikut tampil.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Foto yang sudah termuat di cache (mis. hasil SSR/hidrasi) tidak lagi
  // memancarkan `load` — cek manual supaya tidak terjebak selamanya transparan.
  useEffect(() => {
    const img = imgRef.current
    if (src && img && img.complete && img.naturalWidth > 0) {
      setLoadedSrc(src)
    }
  }, [src])

  const showImage = src != null && src === loadedSrc

  return (
    <span
      className={cn('avatar', className)}
      data-status={showImage ? 'loaded' : undefined}
    >
      {src ? (
        <img
          ref={imgRef}
          className="avatar__image"
          src={src}
          alt={alt}
          onLoad={() => setLoadedSrc(src)}
        />
      ) : null}
      <span className="avatar__fallback">{fallback}</span>
    </span>
  )
}
