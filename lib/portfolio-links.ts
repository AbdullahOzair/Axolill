export const PROJECT_LINK_LIMIT = 2048;

export function portfolioProjectPath({ id, title }: { id: string; title: string }) {
  const name = title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").slice(0, 72).replace(/^-|-$/g, "");
  return `/portfolio/${name || "project"}~${encodeURIComponent(id)}`;
}

export function portfolioIdFromSlug(slug: string) {
  const separator = slug.indexOf("~");
  const id = slug.slice(separator + 1);
  return separator > 0 && id.length > 0 && id.length <= 128 ? id : null;
}

export function portfolioLiveUrl(value: string | null | undefined) {
  const url = value?.trim();
  if (!url || url.length > PROJECT_LINK_LIMIT || !/^https:\/\/[^/]/i.test(url) || /[\s\\\p{Cc}]/u.test(url)) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : null;
  } catch {
    return null;
  }
}

export function portfolioCaseStudyPath(value: string | null | undefined) {
  const path = value?.trim();
  if (!path || path.length > PROJECT_LINK_LIMIT || !/^\/(?!\/)/.test(path) || /[\s\\\p{Cc}]/u.test(path)) return null;
  return path;
}
