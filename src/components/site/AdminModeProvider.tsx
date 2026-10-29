import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { useIsStaff } from '#/lib/use-is-staff'

type AdminModeContextValue = {
  isStaff: boolean
  /** Jalankan aksi pelanggan, atau tampilkan dialog mode admin bila staff. */
  guard: (action: () => void) => void
  showAdminDialog: () => void
}

const AdminModeContext = createContext<AdminModeContextValue | null>(null)

const FALLBACK: AdminModeContextValue = {
  isStaff: false,
  guard: (action) => action(),
  showAdminDialog: () => undefined,
}

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { isStaff } = useIsStaff()
  const [open, setOpen] = useState(false)

  const showAdminDialog = useCallback(() => setOpen(true), [])
  const guard = useCallback(
    (action: () => void) => {
      if (isStaff) {
        setOpen(true)
        return
      }
      action()
    },
    [isStaff],
  )
  const value = useMemo(
    () => ({ isStaff, guard, showAdminDialog }),
    [isStaff, guard, showAdminDialog],
  )

  return (
    <AdminModeContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </span>
            <DialogTitle>Mode admin aktif</DialogTitle>
            <DialogDescription>
              Keranjang dan checkout pelanggan dinonaktifkan selama kamu login
              sebagai admin. Gunakan POS untuk membuat pesanan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-full">
                Tutup
              </Button>
            </DialogClose>
            <Button asChild className="rounded-full">
              <Link to="/admin/pos">Buka POS</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminModeContext.Provider>
  )
}

export function useAdminMode(): AdminModeContextValue {
  return useContext(AdminModeContext) ?? FALLBACK
}
