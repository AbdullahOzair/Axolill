import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { authRedirect } from "../lib/auth-redirect";
import { openCalendarToken, sealCalendarToken } from "../lib/calendar-token-crypto";
import { matchesCmsImageType } from "../lib/cms-image";
import { boundedBody, sameOrigin } from "../lib/http-security";
import { safeMeetingLink } from "../lib/meeting-link";

test("post-login destinations stay within the signed-in area", () => {
  assert.equal(authRedirect("/admin/settings/security?tab=mfa#setup", "/admin"),
    "/admin/settings/security?tab=mfa#setup");
  assert.equal(authRedirect("/portal/book", "/portal"), "/portal/book");
  assert.equal(authRedirect("/?book=1", "/portal"), "/?book=1");
  assert.equal(authRedirect("/?book=1", "/admin"), "/admin");
  for (const path of [
    null, "/admin", "/portal/../admin", "/portal-extra", "https://example.invalid/",
    "//example.invalid/portal", "//[", "/\\example.invalid/portal", "data:text/plain,example",
    "/?book=1&next=https://example.invalid", "//example.invalid/?book=1",
  ]) {
    assert.equal(authRedirect(path, "/portal"), "/portal");
  }
});

test("cookie-authenticated writes require the configured origin", () => {
  const canonical = "https://axonill.invalid";
  const request = (headers: HeadersInit) => new Request(canonical, { method: "POST", headers });
  assert.equal(sameOrigin(request({ origin: canonical, "sec-fetch-site": "same-origin" }), canonical), true);
  assert.equal(sameOrigin(request({ origin: "https://example.invalid" }), canonical), false);
  assert.equal(sameOrigin(request({ origin: canonical, "sec-fetch-site": "cross-site" }), canonical), false);
  assert.equal(sameOrigin(request({}), canonical), false);
});

test("request caps apply even when Content-Length is missing or understated", async () => {
  const cases: HeadersInit[] = [{}, { "content-length": "1" }, { "content-length": "50" }];
  for (const headers of cases) {
    const request = new Request("http://localhost/", { method: "POST", body: "over", headers });
    const rejected = await boundedBody(request, 3);
    assert.ok(rejected instanceof Response);
    assert.equal(rejected.status, 413);
  }
  const request = new Request("http://localhost/", { method: "POST", body: "fits" });
  const accepted = await boundedBody(request, 4);
  assert.ok(accepted instanceof ArrayBuffer);
  assert.equal(new TextDecoder().decode(accepted), "fits");
});

test("CMS uploads validate image signatures as well as MIME labels", async () => {
  assert.equal(await matchesCmsImageType(new Blob(["plain text"], { type: "image/png" })), false);
  assert.equal(await matchesCmsImageType(new Blob(["<svg/>"], { type: "image/svg+xml" })), false);
  const bytes = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  assert.equal(await matchesCmsImageType(new Blob([bytes], { type: "image/png" })), true);
  assert.equal(await matchesCmsImageType(new Blob([bytes], { type: "image/jpeg" })), false);
});

test("untrusted descriptive text is escaped in React text nodes", () => {
  const html = renderToStaticMarkup(createElement("p", null, "<strong>Example</strong>"));
  assert.equal(html, "<p>&lt;strong&gt;Example&lt;/strong&gt;</p>");
});

test("meeting links require HTTPS and exclude URL credentials", () => {
  assert.equal(safeMeetingLink("https://meet.google.com/example"), "https://meet.google.com/example");
  assert.equal(safeMeetingLink("http://example.invalid/meeting"), null);
  assert.equal(safeMeetingLink("https://user@example.invalid/meeting"), null);
  assert.equal(safeMeetingLink("Phone call"), null);
});

test("Calendar token encryption preserves legacy reads and binds tokens to their field and owner", async () => {
  const key = "a1".repeat(32);
  const token = "synthetic-calendar-token";
  const context = "admin-1:refresh";
  const sealed = await sealCalendarToken(token, key, context);
  assert.notEqual(sealed, await sealCalendarToken(token, key, context));
  assert.equal(await openCalendarToken(sealed, key, context), token);
  assert.equal(await openCalendarToken(token, key, context), token);
  await assert.rejects(openCalendarToken(sealed, key, "admin-2:refresh"));
  await assert.rejects(openCalendarToken(sealed, key, "admin-1:access"));
  await assert.rejects(openCalendarToken(sealed, undefined, context));
});
