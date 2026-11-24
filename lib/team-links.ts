export const TEAM_LINK_LIMIT = 2048;

export function teamProfileUrl(value: string | null | undefined) {
  const url = value?.trim();
  if (!url || url.length > TEAM_LINK_LIMIT || !/^https?:\/\/[^/]/i.test(url) || /[\s\\\p{Cc}]/u.test(url)) return null;

  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username && !parsed.password && parsed.href.length <= TEAM_LINK_LIMIT
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
