/** Returns the primary category from the professionals.categories TEXT[] column. */
export function getPrimaryCategory(categories: unknown): string {
  if (!Array.isArray(categories) || categories.length === 0) return '';
  return typeof categories[0] === 'string' ? categories[0] : '';
}
