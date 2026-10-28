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

const inactiveStylesheets: Record<Layout, string> = {
  public: adminCss,
  admin: appCss,
}

// Layout public dan admin memakai compile unit Tailwind terpisah dan tidak boleh
// aktif bersamaan. useLayoutEffect mencegah satu frame dengan CSS campuran; di
// server efek tidak pernah berjalan.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

function layoutForPath(pathname: string): Layout {
  return pathname === '/admin' || pathname.startsWith('/admin/')
    ? 'admin'
    : 'public'
}

/**
 * React 19 mempertahankan `<link rel="stylesheet">` yang di-hoist (memiliki
 * `precedence`) walaupun route pemiliknya sudah tidak aktif. Tanpa pembersihan,
 * stylesheet admin ikut menimpa halaman publik — atau sebaliknya — sehingga
 * token warna, tipografi, dan utility kedua layout saling bertabrakan.
 *
 * Penjaga ini menyisakan tepat satu stylesheet layout sesuai rute aktif dan
 * menambahkan kembali stylesheet yang dibutuhkan bila React menganggapnya masih
 * terpasang (padahal sudah dilepas saat pindah layout).
 */
export function useRouteStylesheet() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const layout = layoutForPath(pathname)

  useIsomorphicLayoutEffect(() => {
    if (typeof document === 'undefined') return

    const activeHref = stylesheets[layout]
    const inactiveHref = inactiveStylesheets[layout]

    // Remove any stylesheet links that belong to the inactive layout
    // Match by href (in case React hoisted links lost attributes) and by attribute
    const allStylesheetLinks = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"]',
    )

    const activeLinks: HTMLLinkElement[] = []

    for (const link of allStylesheetLinks) {
      const href = link.getAttribute('href') || ''
      const attr = link.getAttribute(STYLE_ATTR)

      // If it's the inactive layout's stylesheet (by href or by attribute), remove it
      if (href === inactiveHref || attr === (layout === 'admin' ? 'public' : 'admin')) {
        link.remove()
        continue
      }

      // If it's the active layout's stylesheet
      if (href === activeHref || attr === layout) {
        activeLinks.push(link)
      }
    }

    // Keep exactly one active link
    if (activeLinks.length > 0) {
      const [current, ...duplicates] = activeLinks
      for (const dup of duplicates) {
        dup.remove()
      }

      if (current.getAttribute('href') !== activeHref) {
        current.href = activeHref
      }
      current.setAttribute(STYLE_ATTR, layout)
      if (!current.getAttribute('precedence')) {
        current.setAttribute('precedence', 'default')
      }
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = activeHref
    link.setAttribute(STYLE_ATTR, layout)
    link.setAttribute('precedence', 'default')
    document.head.appendChild(link)
  }, [layout])
}

/** Null-render guard yang dipasang sekali di root document. */
export function LayoutStylesheetGuard() {
  useRouteStylesheet()
  return null
}
