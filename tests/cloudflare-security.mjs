import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const origin = new URL(process.env.AXONILL_TEST_URL ?? "http://localhost:8791");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname), "Use an isolated local Worker");

if (process.argv.includes("--prepare")) {
  const directory = path.join(root, ".wrangler", "security-check-" + randomUUID());
  mkdirSync(directory, { recursive: true });
  const configFile = path.join(root, "wrangler.jsonc");
  const { config } = ts.parseConfigFileTextToJson(configFile, readFileSync(configFile, "utf8"));
  delete config.account_id;
  delete config.routes;
  delete config.$schema;
  config.name = "axonill-security-test";
  config.workers_dev = false;
  config.main = path.resolve(root, config.main);
  config.assets.directory = path.resolve(root, config.assets.directory);
  config.d1_databases[0].migrations_dir = path.resolve(root, config.d1_databases[0].migrations_dir);
  writeFileSync(path.join(directory, "wrangler.json"), JSON.stringify(config, null, 2));
  writeFileSync(path.join(directory, ".dev.vars"), [
    "BETTER_AUTH_URL=" + origin.origin,
    "GOOGLE_CLIENT_ID=local-test-id",
    "GOOGLE_CLIENT_SECRET=" + randomBytes(32).toString("hex"),
    "BETTER_AUTH_SECRET=" + randomBytes(32).toString("hex"),
    "GOOGLE_CALENDAR_TOKEN_KEY=" + randomBytes(32).toString("hex"),
    "CAL_WEBHOOK_SECRET=" + randomBytes(32).toString("hex"),
  ].join("\n") + "\n");
  execFileSync(process.execPath, [
    path.join(root, "node_modules", "wrangler", "bin", "wrangler.js"),
    "d1", "migrations", "apply", "DB", "--local",
  ], { cwd: directory, stdio: ["ignore", "pipe", "pipe"] });
  console.log(directory);
  process.exit(0);
}

const fixture = path.resolve(process.env.AXONILL_TEST_FIXTURE ?? "");
assert.equal(path.dirname(fixture), path.join(root, ".wrangler"));
assert.ok(path.basename(fixture).startsWith("security-check-"));
const config = JSON.parse(readFileSync(path.join(fixture, "wrangler.json"), "utf8"));
assert.ok(config.workers_dev === false && !config.account_id && !config.routes,
  "Use an isolated Wrangler config without production routes");

function localRequest(route, { cookies, method = "GET", body, headers = {} } = {}) {
  const outgoing = new Headers(headers);
  outgoing.set("connection", "close");
  if (cookies?.size) outgoing.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
  if (method !== "GET" && !outgoing.has("origin")) outgoing.set("origin", origin.origin);
  if (body && !(body instanceof FormData) && !outgoing.has("content-type")) {
    outgoing.set("content-type", "application/json");
  }
  return fetch(new URL(route, origin), {
    method,
    body: body instanceof FormData || typeof body === "string" ? body : JSON.stringify(body),
    headers: outgoing,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
}

function updateCookies(jar, response) {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0];
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}

async function expectStatus(route, status, options) {
  const response = await localRequest(route, options);
  assert.equal(response.status, status, `${options?.method ?? "GET"} ${route}`);
  return response;
}

function provision(email, ...flags) {
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [
      path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(root, "scripts", "create-admin.ts"),
      email,
      ...flags,
    ], { cwd: fixture, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const reason = String(error.stderr ?? "").match(/^Wrangler could not execute the database batch.*$/m)?.[0];
    throw new Error(reason ?? "The local admin provisioning command failed.");
  }
  const generated = stdout.match(/Generated password \(shown once\): ([\w-]+)/)?.[1];
  assert.ok(generated, "Admin provisioning did not return a generated credential");
  return generated;
}

async function recoverLocalAdmin(email) {
  // Wrangler opens the same local SQLite state in a separate Workerd process.
  // Give the running local Worker time to finish its previous database request.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    await delay(1500);
    try {
      return provision(email, "--reset-mfa");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function authenticatorCode(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const character of secret.toUpperCase().replace(/=+$/, "")) {
    const value = alphabet.indexOf(character);
    assert.ok(value >= 0, "Authenticator setup key was not base32");
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  return String((digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const run = randomUUID();
const homepage = await expectStatus("/", 200);
assert.equal(homepage.headers.get("x-content-type-options"), "nosniff");
assert.equal(homepage.headers.get("x-frame-options"), "DENY");
assert.ok(homepage.headers.has("content-security-policy-report-only"));
const html = await homepage.text();
assert.ok(html.includes("Axonill") && html.includes("services") && html.includes("contact"));
await expectStatus("/admin", 307);
await expectStatus("/portal", 307);
const protectedRoutes = {
  GET: [
    "/api/admin/google-calendar", "/api/admin/google-calendar/connect", "/api/admin/google-calendar/callback",
    "/api/admin/leads/test", "/api/clients", "/api/contact", "/api/invoices", "/api/invoices/test",
    "/api/meetings", "/api/projects", "/api/projects/test", "/api/projects/test/files",
    "/api/projects/test/files/test", "/api/projects/test/milestones", "/api/media/leads/synthetic-unavailable-file",
  ],
  POST: [
    "/api/invoices", "/api/media", "/api/meetings/google", "/api/meetings/request", "/api/portal/intake",
    "/api/projects", "/api/projects/test/files", "/api/projects/test/milestones",
    "/api/portfolio", "/api/services", "/api/team", "/api/technologies", "/api/testimonials",
  ],
  PATCH: [
    "/api/admin/leads/test", "/api/invoices/test", "/api/meetings/test", "/api/projects/test",
    "/api/projects/test/milestones/test", "/api/portfolio/test", "/api/services/test",
    "/api/team/test", "/api/technologies/test", "/api/testimonials/test",
  ],
  DELETE: [
    "/api/admin/google-calendar", "/api/invoices/test", "/api/projects/test", "/api/projects/test/files/test",
    "/api/projects/test/milestones/test", "/api/portfolio/test", "/api/services/test",
    "/api/team/test", "/api/technologies/test", "/api/testimonials/test",
  ],
};
for (const [method, routes] of Object.entries(protectedRoutes)) {
  for (const route of routes) await expectStatus(route, 401, { method });
}
console.log("Public homepage, security headers, and signed-out access verified.");

const client = new Map();
const clientEmail = `client-${run}@example.com`;
const signup = await expectStatus("/api/auth/sign-up/email", 200, {
  method: "POST",
  body: { name: "Security Test Client", email: clientEmail, password: randomBytes(24).toString("hex"), role: "admin" },
});
updateCookies(client, signup);
assert.equal((await signup.json()).user.role, "client");
await expectStatus("/api/clients", 403, { cookies: client });
await expectStatus("/api/auth/two-factor/enable", 403, { method: "POST", cookies: client, body: {} });
await expectStatus("/portal", 200, { cookies: client });
await expectStatus("/portal/book", 200, { cookies: client });

const admin = new Map();
const adminEmail = `admin-${run}@example.com`;
let password = provision(adminEmail);
const signIn = () => expectStatus("/api/auth/sign-in/email", 200, {
  method: "POST", cookies: admin, body: { email: adminEmail, password },
});
const login = await signIn();
const sessionCookies = login.headers.getSetCookie();
assert.ok(sessionCookies.some((header) => /HttpOnly/i.test(header) && /SameSite=Lax/i.test(header)));
if (origin.protocol === "https:") {
  assert.ok(sessionCookies.some((header) => /;\s*Secure(?:;|$)/i.test(header)));
}
updateCookies(admin, login);
const clients = await expectStatus("/api/clients", 200, { cookies: admin });
assert.match(clients.headers.get("cache-control"), /private.*no-store/);
await expectStatus("/admin", 200, { cookies: admin });

const service = { icon: "Sparkles", title: "Security test draft" };
await expectStatus("/api/services", 403, { method: "POST", cookies: client, body: service });
await expectStatus("/api/services", 403, {
  method: "POST", cookies: admin, body: service, headers: { origin: "https://example.invalid" },
});
await expectStatus("/api/services", 400, { method: "POST", cookies: admin, body: { title: 1 } });
const draft = await expectStatus("/api/services", 201, { method: "POST", cookies: admin, body: service });
const draftId = (await draft.json()).service.id;
const services = await expectStatus("/api/services", 200);
assert.ok(!(await services.json()).services.some((item) => item.id === draftId));

const upload = new FormData();
upload.append("file", new Blob(["plain text"], { type: "image/png" }), "sample.png");
await expectStatus("/api/media", 400, { method: "POST", cookies: admin, body: upload });
const image = new FormData();
image.append("file", new Blob([readFileSync(path.join(root, "app", "icon.png"))], {
  type: "image/png",
}), "sample.png");
const uploaded = await expectStatus("/api/media", 201, { method: "POST", cookies: admin, body: image });
const asset = await expectStatus((await uploaded.json()).url, 200);
assert.equal(asset.headers.get("content-type"), "image/png");

const intake = new FormData();
for (const [key, value] of Object.entries({
  projectName: "Security test project",
  projectType: "Website",
  description: "Synthetic project intake",
  features: "[]",
  budgetRange: "Undecided",
  timeline: "Flexible",
  wantsCall: "false",
})) intake.set(key, value);
intake.append("files", new Blob(["Private test attachment"], { type: "text/plain" }), "intake.txt");
const submitted = await expectStatus("/api/portal/intake", 201, {
  method: "POST", cookies: client, body: intake,
});
const leadId = (await submitted.json()).leadId;
const lead = await expectStatus(`/api/admin/leads/${leadId}`, 200, { cookies: admin });
const download = `/api/media/${(await lead.json()).attachments[0].r2Key}`;
await expectStatus(download, 401);
await expectStatus(download, 403, { cookies: client });
const attachment = await expectStatus(download, 200, { cookies: admin });
assert.match(attachment.headers.get("content-disposition"), /^attachment/);
assert.match(attachment.headers.get("cache-control"), /private.*no-store/);
console.log("Client and admin authorization, CSRF, validation, CMS media, and private intake attachments verified.");

const connection = await expectStatus("/api/admin/google-calendar/connect", 302, { cookies: admin });
updateCookies(admin, connection);
const calendarLocation = new URL(connection.headers.get("location"));
assert.equal(calendarLocation.origin, "https://accounts.google.com");
assert.equal(calendarLocation.searchParams.get("redirect_uri"), `${origin.origin}/api/admin/google-calendar/callback`);
await expectStatus("/api/admin/google-calendar/callback?state=invalid", 302, { cookies: admin });
const googleLogin = await expectStatus("/api/auth/sign-in/social", 200, {
  method: "POST", body: { provider: "google", callbackURL: "/portal" },
});
const googleUrl = new URL((await googleLogin.json()).url);
assert.equal(googleUrl.origin, "https://accounts.google.com");
assert.equal(googleUrl.searchParams.get("redirect_uri"), `${origin.origin}/api/auth/callback/google`);
const webhookSecret = readFileSync(path.join(fixture, ".dev.vars"), "utf8")
  .match(/^CAL_WEBHOOK_SECRET=(.+)$/m)?.[1].trim();
assert.ok(webhookSecret, "Local webhook fixture is missing its signing key");
const webhook = JSON.stringify({ triggerEvent: "TEST_EVENT", payload: { uid: run, startTime: new Date().toISOString() } });
await expectStatus("/api/meetings", 403, { method: "POST", body: webhook });
await expectStatus("/api/meetings", 200, {
  method: "POST", body: webhook,
  headers: { "x-cal-signature-256": createHmac("sha256", webhookSecret).update(webhook).digest("hex") },
});
console.log("Google OAuth redirect destinations, Calendar state rejection, and Cal.com webhook signature verified.");

const beforeMfa = new Map(admin);
const enrollment = await expectStatus("/api/auth/two-factor/enable", 200, {
  method: "POST", cookies: admin, body: { password },
});
updateCookies(admin, enrollment);
const setup = await enrollment.json();
const secret = new URL(setup.totpURI).searchParams.get("secret");
const verification = await expectStatus("/api/auth/two-factor/verify-totp", 200, {
  method: "POST", cookies: admin, body: { code: authenticatorCode(secret) },
});
updateCookies(admin, verification);
await expectStatus("/api/clients", 401, { cookies: beforeMfa });
await expectStatus("/api/clients", 200, { cookies: admin });
await expectStatus("/admin/settings/security", 200, { cookies: admin });

const signOut = await expectStatus("/api/auth/sign-out", 200, { method: "POST", cookies: admin });
updateCookies(admin, signOut);
const challenge = await signIn();
updateCookies(admin, challenge);
assert.equal((await challenge.json()).twoFactorRedirect, true);
await expectStatus("/api/clients", 401, { cookies: admin });
const recovery = await expectStatus("/api/auth/two-factor/verify-backup-code", 200, {
  method: "POST", cookies: admin, body: { code: setup.backupCodes[0] },
});
updateCookies(admin, recovery);
await expectStatus("/api/clients", 200, { cookies: admin });
password = await recoverLocalAdmin(adminEmail);
await expectStatus("/api/clients", 401, { cookies: admin });
admin.clear();
updateCookies(admin, await signIn());
await expectStatus("/api/clients", 200, { cookies: admin });
console.log("MFA enrollment, recovery code, session revocation, and CLI recovery verified.");

await expectStatus("/api/contact", 413, { method: "POST", body: JSON.stringify({ message: "x".repeat(70_000) }) });
for (let i = 0; i < 4; i++) {
  await expectStatus("/api/contact", 201, {
    method: "POST", body: { name: "Security Check", email: "test@example.com", message: `Test message ${i}` },
  });
}
await expectStatus("/api/contact", 429, {
  method: "POST", body: { name: "Security Check", email: "test@example.com", message: "Rate limit check" },
});
console.log("Contact validation, bounded request parsing, and rate limiting verified.");
