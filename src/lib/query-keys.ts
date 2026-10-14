export const queryKeys = {
  me: () => ['me'] as const,
  products: {
    bestSellers: () => ['products', 'best-sellers'] as const,
    recommendations: () => ['products', 'recommendations'] as const,
    recs: (limit: number) => ['products', 'recs', limit] as const,
    detail: (slug: string) => ['products', 'detail', slug] as const,
    list: (params: Record<string, unknown>) => ['products', 'list', params] as const,
  },
  katalog: {
    categories: () => ['katalog', 'categories'] as const,
    facets: () => ['katalog', 'facets'] as const,
  },
  cart: () => ['cart'] as const,
  checkout: (input: unknown) => ['checkout', input] as const,
  orders: {
    my: () => ['orders', 'my'] as const,
  },
  newsletter: {
    status: () => ['newsletter', 'status'] as const,
  },
  admin: {
    overview: () => ['admin', 'overview'] as const,
    products: (params: Record<string, unknown>) => ['admin', 'products', params] as const,
    product: (id: string) => ['admin', 'product', id] as const,
    orders: (params: Record<string, unknown>) => ['admin', 'orders', params] as const,
    order: (id: string) => ['admin', 'order', id] as const,
    users: (params: Record<string, unknown>) => ['admin', 'users', params] as const,
    attributes: () => ['admin', 'attributes'] as const,
    posVariants: (q: string) => ['admin', 'pos-variants', q] as const,
    dictionary: (params: Record<string, unknown>) => ['admin', 'dictionary', params] as const,
    recommender: () => ['admin', 'recommender'] as const,
    recommenderProduct: (id: string) => ['admin', 'recommender-product', id] as const,
  },
}
