/** Re-throw Next.js redirect "errors" so the router can handle them. */
export function rethrowIfRedirect(err: unknown): void {
  if (
    err instanceof Error &&
    (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")
  ) {
    throw err;
  }
}
