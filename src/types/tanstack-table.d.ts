/**
 * Augmentasi @tanstack/react-table v9: `ColumnMeta` bawaan adalah interface
 * kosong, sehingga membaca `columnDef.meta.className` (dipakai AdminTable untuk
 * rata kolom) perlu tipe eksplisit tanpa assertion di setiap pemakaian.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TFeatures extends TableFeatures, TData extends RowData, TValue> {
    /** Utility tambahan untuk sel/kepala kolom, mis. `text-right`. */
    className?: string
  }
}
