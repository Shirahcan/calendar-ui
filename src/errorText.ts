/**
 * What to tell a person when something they did was refused or failed: the error's message plus
 * the reasons it carries. calendar-service refuses with a summary ("The scheduling policy is not
 * valid.") and a list of reasons; a product's API client usually keeps the list on `errors` (an
 * array, or a field => messages map). Showing only the summary leaves the person unable to fix it.
 */
export function errorText(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;

  const raw = (error as Error & { errors?: unknown }).errors;
  const reasons: string[] = Array.isArray(raw)
    ? raw.filter((r): r is string => typeof r === 'string')
    : raw && typeof raw === 'object'
      ? Object.values(raw as Record<string, unknown>).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((r): r is string => typeof r === 'string')
      : [];
  const extra = reasons.filter((r) => r !== error.message);

  return extra.length ? `${error.message} ${extra.join(' ')}` : error.message;
}
