import { Component, StrictMode, startTransition } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { hydrateStart } from '@tanstack/react-start/client'

// The entry mounts the React root once for the whole document, so hot-swapping
// it would call `hydrateRoot` on an already-hydrated document. Accept the
// update but reload the page instead, which re-runs hydration from scratch.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())

declare global {
  interface Window {
    __ttcClientBooted?: boolean
  }
}

// HMR evaluates this module again *before* the accept callback above runs, so
// the reload alone is not enough: re-running `hydrateRoot` would throw
// "container has already been passed to createRoot()". This flag makes the
// entry idempotent for the lifetime of the document.
const alreadyBooted = window.__ttcClientBooted === true
window.__ttcClientBooted = true

/**
 * Root client entry.
 *
 * TanStack Start's default entry awaits the bootstrap promise inside its
 * `<AwaitInner>` component. If that promise rejects — a stale dev chunk, a
 * version mismatch after a deploy, a one-off network failure — React unmounts
 * the whole tree and only logs the generic
 * "An error occurred in the <AwaitInner> component" message, leaving a blank
 * page.
 *
 * We await the same bootstrap promise ourselves instead. A transient failure
 * gets one automatic reload (the usual fix for stale assets); if that still
 * fails, the user sees a recovery screen rather than a blank page.
 */
const RETRY_KEY = 'ttc:hydration-retry'

function readRetryFlag() {
  try {
    return sessionStorage.getItem(RETRY_KEY) === '1'
  } catch {
    return false
  }
}

function setRetryFlag() {
  try {
    sessionStorage.setItem(RETRY_KEY, '1')
  } catch {
    // Storage can be unavailable (private mode / blocked cookies). The
    // fallback UI is still shown; the user can reload manually.
  }
}

function clearRetryFlag() {
  try {
    sessionStorage.removeItem(RETRY_KEY)
  } catch {
    // Nothing to clean up.
  }
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Log the failure and reload once for transient startup/render failures.
 * Returns `true` when a reload was started, so the caller can skip rendering
 * a recovery screen that would be thrown away anyway.
 */
function reportFailure(error: Error, info?: ErrorInfo) {
  console.error('[tibatibacamping] Gagal memuat halaman:', error, info)
  if (readRetryFlag()) return false
  setRetryFlag()
  window.location.reload()
  return true
}

async function boot() {
  try {
    const router = await hydrateStart()
    clearRetryFlag()
    startTransition(() => {
      hydrateRoot(
        document,
        <StrictMode>
          <AppErrorBoundary>
            <RouterProvider router={router} />
          </AppErrorBoundary>
        </StrictMode>,
      )
    })
  } catch (error) {
    const normalized = normalizeError(error)
    if (reportFailure(normalized)) return
    // Nothing was hydrated, so a fresh root (not a hydration) is correct and
    // avoids a mismatch against the server-rendered document.
    createRoot(document).render(
      <StrictMode>
        <RecoveryPage />
      </StrictMode>,
    )
  }
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: unknown) {
    return { error: normalizeError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportFailure(normalizeError(error), info)
  }

  render() {
    if (this.state.error) return <RecoveryPage />
    return this.props.children
  }
}

/**
 * Self-contained recovery screen. It replaces the whole document, so it uses
 * inline styles and CSS custom-property fallbacks rather than relying on the
 * app stylesheet still being in `<head>`.
 */
function RecoveryPage() {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Gagal memuat — Tiba Tiba Camping</title>
      </head>
      <body
        style={{
          margin: 0,
          background: 'var(--background, #ffffff)',
          color: 'var(--foreground, #0a0a0a)',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground, #6b7280)',
            }}
          >
            Tiba Tiba Camping
          </p>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
            Halaman gagal dimuat
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 420,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--muted-foreground, #6b7280)',
            }}
          >
            Terjadi gangguan saat memuat halaman. Muat ulang halaman ini; jika
            masih gagal, kembali ke beranda lalu coba lagi.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() => {
                clearRetryFlag()
                window.location.reload()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 36,
                padding: '0 16px',
                border: 'none',
                borderRadius: 9999,
                background: 'var(--primary, #000000)',
                color: 'var(--primary-foreground, #ffffff)',
                font: 'inherit',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Muat ulang
            </button>
            <a
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 36,
                padding: '0 16px',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 9999,
                color: 'inherit',
                font: 'inherit',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Ke beranda
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}

if (!alreadyBooted) void boot()
