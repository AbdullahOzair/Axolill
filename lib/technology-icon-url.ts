export const TECHNOLOGY_ICON_URL_LIMIT = 2048;

export function technologyIconUrlError(value: string) {
  const url = value.trim();
  if (!url) return null;
  if (url.length > TECHNOLOGY_ICON_URL_LIMIT) return "Use an icon URL with 2,048 characters or fewer.";

  const message = "Enter a valid HTTPS image URL without credentials.";
  if (!/^https:\/\/[^/]/i.test(url) || /[\s\\\p{Cc}]/u.test(url)) return message;

  try {
    const parsed = new URL(url);
    return parsed.hostname && !parsed.username && !parsed.password ? null : message;
  } catch {
    return message;
  }
}
