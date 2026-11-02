import { useEffect, useLayoutEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import appCss from '#/styles.css?url'
import adminCss from '#/styles/admin.css?url'

const STYLE_ATTR = 'data-layout-style'

type Layout = 'public' | 'admin'

const stylesheets: Record<Layout, string> = {
  public: appCss,
  admin: adminCss,
}

const LAYOUTS: readonly Layout[] = ['public', 'admin']

/**
 * Layout yang sedang terpasang di DOM. Penentu stylesheet mana yang berlaku
 * aktif — bukan URL rute. Saat pindah layout, layout lama masih tampil selama
 * loader rute tujuan berjalan; stylesheet-nya harus tetap aktif selama itu.
 * Menukar stylesheet berdasarkan URL (dilakukan penjaga rute) membuat halaman
 * lama tampil tanpa gaya selama loader berjalan — itu yang terbaca ±1 detik.
 */
const mountedLayouts = new Set<Layout>()

/** Layout aktif terakhir; dipakai saat tidak ada layout terpasang (mis. antar commit). */
let lastActiveLayout: Layout | null = null

const linkWatchers = new WeakMap<HTMLLinkElement, Promise<void>>()

// Layout public dan admin memakai compile unit Tailwind terpisah dan tidak boleh
// aktif bersamaan. useLayoutEffect mencegah satu frame dengan CSS campuran; di
// server efek tidak pernah berjalan.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

function activeLayout(): Layout | null {
  let latest: Layout | null = null
  for (const layout of mountedLayouts) latest = layout
  return latest ?? lastActiveLayout
}

/** URL stylesheet layout — dipakai route head untuk memasangnya lebih awal. */
export function layoutStylesheetHref(layout: Layout): string {
  return stylesheets[layout]
}

function layoutOfLink(link: HTMLLinkElement): Layout | null {
  const attr = link.getAttribute(STYLE_ATTR)
  if (attr === 'admin' || attr === 'public') return attr
  const href = link.getAttribute('href') || ''
  if (href === appCss) return 'public'
  if (href === adminCss) return 'admin'
  return null
}

function layoutLinks(): HTMLLinkElement[] {
  const links: HTMLLinkElement[] = []
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  )) {
    if (layoutOfLink(link)) links.push(link)
  }
  return links
}

function linkLoaded(link: HTMLLinkElement): boolean {
  if (link.sheet) return true
  try {
    const absolute = new URL(
      link.getAttribute('href') || '',
      window.location.href,
    ).href
    const entry = performance.getEntriesByName(absolute)[0] as
      PerformanceResourceTiming | undefined
    return Boolean(entry && entry.responseEnd > 0)
  } catch {
    return false
  }
}

function watchLinkLoaded(link: HTMLLinkElement): Promise<void> {
  const existing = linkWatchers.get(link)
  if (existing) return existing

  const promise = new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    if (linkLoaded(link)) {
      finish()
      return
    }

    link.addEventListener('load', finish, { once: true })
    link.addEventListener('error', finish, { once: true })
    
  })

  linkWatchers.set(link, promise)
  return promise
}

function ensureLink(layout: Layout, active: boolean): HTMLLinkElement {
  const existing = layoutLinks().find((link) => layoutOfLink(link) === layout)
  if (existing) return existing

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = stylesheets[layout]
  link.media = active ? 'all' : 'not all'
  link.setAttribute(STYLE_ATTR, layout)
  link.setAttribute('precedence', 'default')
  document.head.appendChild(link)
  void watchLinkLoaded(link)
  return link
}

/**
 * Sinkronkan stylesheet dengan layout yang sedang terpasang.
 *
 * Layout nonaktif sengaja TIDAK dihapus — cukup `media="not all"`. Dulu
 * stylesheet-nya dilepas, sehingga setiap pindah layout memicu request ulang;
 * pada jaringan/server yang lambat request itulah yang terbaca sebagai halaman
 * tanpa gaya. Dengan toggle media, file tetap ada di CSSOM dan langsung
 * berlaku begitu layout berubah — tanpa jaringan.
 */
function syncStylesheets(): void {
  const active = activeLayout()
  if (!active) return

  for (const layout of LAYOUTS) {
    const group = layoutLinks().filter((link) => layoutOfLink(link) === layout)
    if (group.length > 1) {
      // Pertahankan yang sudah termuat; buang duplikat agar CSSOM tidak
      // menumpuk setiap pindah layout berulang kali.
      const keeper = group.find((link) => link.sheet) ?? group[0]
      for (const link of group) {
        if (link !== keeper) link.remove()
      }
    }
  }

  for (const link of layoutLinks()) {
    const layout = layoutOfLink(link)
    if (!layout) continue
    link.setAttribute(STYLE_ATTR, layout)
    link.media = layout === active ? 'all' : 'not all'
  }

  if (!layoutLinks().some((link) => layoutOfLink(link) === active)) {
    ensureLink(active, true)
  }
}

/**
 * React 19 mempertahankan `<link rel="stylesheet">` yang di-hoist (memiliki
 * `precedence`) walaupun route pemiliknya sudah tidak aktif. Penjaga ini
 * memanfaatkan itu: stylesheet yang sudah pernah dimuat tidak dilepas, hanya
 * dinonaktifkan lewat `media`, dan diaktifkan kembali saat layout berubah.
 *
 * Penjaga ini juga memastikan stylesheet rute tujuan sudah terpasang (dalam
 * keadaan nonaktif) sedini mungkin, supaya layout berikutnya tinggal
 * mengaktifkannya tanpa menunggu unduhan.
 */
export function useRouteStylesheet() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const layout = layoutForPath(pathname)

  useIsomorphicLayoutEffect(() => {
    if (typeof document === 'undefined') return
    ensureLink(layout, false)
    syncStylesheets()
  }, [layout])
}

/**
 * Aktifkan stylesheet layout milik komponen ini selama ia terpasang.
 *
 * Dipanggil dari layout (public, admin, dan halaman struk) — bukan dari URL —
 * sehingga layout lama tetap bergaya sampai layout baru benar-benar dirender.
 * React menjalankan cleanup lama dan mount baru dalam satu commit sebelum
 * paint, jadi penukarannya tidak pernah tampil setengah jadi.
 */
export function useLayoutStylesheet(layout: Layout) {
  useIsomorphicLayoutEffect(() => {
    if (typeof document === 'undefined') return

    mountedLayouts.add(layout)
    lastActiveLayout = layout
    syncStylesheets()

    return () => {
      mountedLayouts.delete(layout)
      // Saat commit pindah layout, layout lama dilepas lebih dulu lalu layout
      // baru memasang stylesheet-nya. `activeLayout()` jatuh ke layout terakhir
      // selama jeda itu supaya halaman lama tidak kehilangan gayanya.
      syncStylesheets()
    }
  }, [layout])
}

function layoutForPath(pathname: string): Layout {
  return pathname === '/admin' || pathname.startsWith('/admin/')
    ? 'admin'
    : 'public'
}

/**
 * Pastikan stylesheet layout sudah termuat sebelum rute pemiliknya aktif.
 *
 * Elemen `<link rel="stylesheet">` dipasang dengan `media="not all"`: file
 * ikut diunduh dan diparse tapi aturannya tidak berlaku sampai layout-nya
 * terpasang. Karena elemennya sama persis dengan yang nanti dipakai, pindah
 * layout tidak menyentuh jaringan sama sekali.
 *
 * Promise selalu selesai (siap, gagal, atau timeout); pemanggil tetap boleh
 * melanjutkan navigasi.
 */
export function warmLayoutStylesheet(layout: Layout): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()

  const active = activeLayout()
  return watchLinkLoaded(ensureLink(layout, layout === active))
}

/** Null-render guard yang dipasang sekali di root document. */
export function LayoutStylesheetGuard() {
  useRouteStylesheet()
  return null
}
