export function makeSlug(title: string, date = new Date()): string {
  const datePrefix = [
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getFullYear()).slice(-2),
  ].join('-');
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return `${datePrefix}-${words || 'workflow-run'}`;
}
