/**
 * Generate a URL-safe slug from an environment name.
 * Lowercase, replace non-alphanumeric with hyphens, collapse multiple hyphens, trim hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63); // Docker project names have practical limits
}

/**
 * Validate that a slug contains only safe characters.
 * Used to verify slugs before passing to Docker CLI or filesystem operations.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) && slug.length > 0 && slug.length <= 63;
}
