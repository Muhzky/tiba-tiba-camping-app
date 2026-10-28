# Plan: Fix messy public catalog after leaving admin "Lihat situs"

## Context
Admin layout (`src/routes/admin/route.tsx`) injects `admin.css` via route head with `data-layout-style="admin"`. Public pages use `appCss`. `useRouteStylesheet` (guard in `__root.tsx`) is responsible for removing the inactive layout stylesheet when route changes. When navigating admin → public via "Lihat situs" (`Link to="/"`), catalog CSS appears broken, indicating admin CSS remains active.

## Root cause
The guard only matches `link[rel="stylesheet"][data-layout-style]`. React 19 hoisted stylesheet links (and TanStack HeadContent-managed links) may lose/retain attributes or be re-injected, so admin CSS can survive the transition. Also removal runs only after layout effect; hoisted links may be re-added by React before cleanup.

## Implementation tasks
1. In `src/lib/use-layout-stylesheet.tsx`, make cleanup match by href as well as attribute: remove any stylesheet link whose href points to the inactive layout's CSS (`adminCss`/`appCss`) or whose `data-layout-style` differs from active layout.
2. Keep exactly one active link; if missing, create it. If multiple active links exist, remove duplicates.
3. Add `precedence` handling: set `link.setAttribute('precedence', 'default')` (or `media`) on created/retained links so React 19 treats them as managed and doesn't resurrect removed ones.
4. Ensure guard runs useLayoutEffect before paint (already) and also listen to `popstate`/router events? Optionally add a MutationObserver in dev to detect resurrected links; not needed for fix.
5. Verify no admin CSS classes leak into catalog: test manual navigation admin → "/" → "/katalog".

## Validation
- `npm run lint`, `npm run typecheck` (if available).
- Manual: admin → Lihat situs → katalog should render with public styles only.
