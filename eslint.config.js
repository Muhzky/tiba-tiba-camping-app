//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    // Drizzle's static types can't express "no row returned", and
    // components/ui is vendored shadcn code we don't lint-fix.
    files: ['src/server/**/*.ts', 'src/components/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-shadow': 'off',
    },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js', '.output/**', 'drizzle/**'],
  },
]
