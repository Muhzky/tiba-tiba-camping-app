const CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY ?? ''

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void
          onPending?: (result: unknown) => void
          onError?: (result: unknown) => void
          onClose?: () => void
        },
      ) => void
    }
  }
}

let snapPromise: Promise<void> | null = null

function snapSrc(): string {
  const prod = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true'
  return prod
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js'
}

export function loadSnap(): Promise<void> {
  if (window.snap) return Promise.resolve()
  if (snapPromise) return snapPromise
  snapPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = snapSrc()
    script.setAttribute('data-client-key', CLIENT_KEY)
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      snapPromise = null
      reject(new Error('Gagal memuat Midtrans Snap'))
    }
    document.body.appendChild(script)
  })
  return snapPromise
}

export function paySnap(token: string): Promise<'success' | 'pending' | 'closed'> {
  return loadSnap().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.snap) {
          reject(new Error('Snap tidak tersedia'))
          return
        }
        window.snap.pay(token, {
          onSuccess: () => resolve('success'),
          onPending: () => resolve('pending'),
          onError: () => reject(new Error('Pembayaran gagal')),
          onClose: () => resolve('closed'),
        })
      }),
  )
}
