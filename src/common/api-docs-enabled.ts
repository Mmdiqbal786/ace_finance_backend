/**
 * Swagger / branded API docs gate.
 * - Explicit ENABLE_API_DOCS=true → on
 * - Explicit ENABLE_API_DOCS=false → off
 * - Azure App Service (WEBSITE_*) → off unless explicitly true
 * - Local / non-production → on by default
 */
export function apiDocsEnabled(): boolean {
  const flag = (process.env.ENABLE_API_DOCS || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;

  const onAzure = Boolean(
    process.env.WEBSITE_SITE_NAME ||
      process.env.WEBSITE_INSTANCE_ID ||
      process.env.WEBSITE_HOSTNAME,
  );
  if (onAzure) return false;

  return process.env.NODE_ENV !== 'production';
}
