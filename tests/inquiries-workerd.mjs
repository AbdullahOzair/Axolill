import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const fixture = path.resolve(process.env.AXONILL_TEST_FIXTURE ?? "");
assert.equal(path.dirname(fixture), path.resolve(".wrangler"));
assert.ok(path.basename(fixture).startsWith("security-check-"));
const config = JSON.parse(readFileSync(path.join(fixture, "wrangler.json"), "utf8"));
assert.ok(config.workers_dev === false && !config.account_id && !config.routes);
const origin = new URL(process.env.AXONILL_TEST_URL ?? "http://localhost:8791");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));

const adminEmail = "inquiry-admin-" + randomUUID() + "@example.com";
const provision = execFileSync(process.execPath, [
  path.resolve("node_modules/tsx/dist/cli.mjs"), path.resolve("scripts/create-admin.ts"), adminEmail,
], { cwd: fixture, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const password = provision.match(/Generated password \(shown once\): ([\w-]+)/)?.[1];
assert.ok(password);

async function send(route, { body, method = body ? "POST" : "GET", cookie, externalOrigin } = {}) {
  return fetch(new URL(route, origin), {
    method,
    headers: {
      connection: "close", ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method === "GET" ? {} : { origin: externalOrigin ?? origin.origin }), ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
}

async function check(route, status, options) {
  const response = await send(route, options);
  if (response.status !== status) {
    const problem = await response.json().catch(() => null);
    assert.fail(`${options?.method ?? "request"} ${route}: expected ${status}, received ${response.status} (${problem?.error ?? "no error body"})`);
  }
  return response;
}

const stamp = randomUUID();
const inquiryApi = "/api/admin/inquiries";
for (const route of [inquiryApi, inquiryApi + "/analytics", inquiryApi + "/example", inquiryApi + "?export=csv"]) {
  await check(route, 401);
}
await check(inquiryApi + "/example/convert", 401, { body: {} });
const login = await check("/api/auth/sign-in/email", 200, { body: { email: adminEmail, password } });
const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
assert.ok(cookie);
const signup = await check("/api/auth/sign-up/email", 200, {
  body: { name: "Inquiry fixture reader", email: `client-${stamp}@example.com`, password: randomUUID() },
});
const clientCookie = signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
await check(inquiryApi, 403, { cookie: clientCookie });
await check(inquiryApi + "/analytics", 403, { cookie: clientCookie });
await check("/admin/conversions", 200, { cookie });

const serviceResponse = await check("/api/services", 201, {
  cookie, body: { icon: "CodeXml", title: "Fixture Web Development", items: ["Fixture Web application"], published: true },
});
const published = (await serviceResponse.json()).service;
await check("/api/services", 201, {
  cookie, body: { icon: "CodeXml", title: "Unpublished fixture", items: ["Private service"], published: false },
});
const catalogue = (await (await check("/api/inquiries/services", 200)).json()).services;
assert.ok(!catalogue.some((item) => item.label === "Private service"));
const choice = catalogue.find((item) => item.serviceId === published.id);
assert.equal(choice.group, "technology");
await check(inquiryApi + "/settings", 200, {
  method: "PATCH", cookie, body: { domesticCountry: "PK", serviceGroups: { [choice.key]: "creative" } },
});
const remapped = (await (await check("/api/inquiries/services", 200)).json()).services.find((item) => item.key === choice.key);
assert.equal(remapped.group, "creative");

const teamResponse = await check("/api/team", 201, {
  cookie, body: { name: "Inquiry fixture assignee", role: "Specialist" },
});
const assigneeId = (await teamResponse.json()).member.id;

const sessionId = randomUUID();
for (const event of [
  { event: "viewed", referral: "example.net", campaign: { source: "fixture-source" } },
  { event: "viewed", referral: "example.net", campaign: { source: "fixture-source" } },
  { event: "selected", type: "IDEA" },
  { event: "started", type: "IDEA", step: 1 },
]) {
  await check("/api/inquiries/events", 200, { body: { ...event, sessionId } });
}
await check("/api/inquiries/events", 400, { body: { event: "submitted", sessionId, text: "Never record this" } });
const rejected = await check("/api/inquiries", 403, { body: {}, externalOrigin: "https://example.net" });
assert.ok((await rejected.json()).error);
const idea = {
  requestId: randomUUID(), type: "IDEA", name: "=Fixture Formula", email: `idea-${stamp}@example.com`,
  company: "Fixture studio", country: "PK", category: "A new business",
  description: "Isolated idea", objectives: "Confirm the isolated idea persists.", sessionId, phone: "+923001234567",
};
const project = {
  requestId: randomUUID(), type: "PROJECT", name: "Fixture project", email: `project-${stamp}@example.com`,
  country: "US", groups: [remapped.group], serviceKeys: [remapped.key], title: "Fixture application",
  description: "Isolated project.", objectives: "Validate the catalogue relationships.", budget: 1250,
  currency: "USD", timeline: "Six weeks", website: "https://example.com",
};
const guidance = {
  requestId: randomUUID(), type: "GUIDANCE", name: "Fixture guidance", email: `guidance-${stamp}@example.com`,
  country: "PK", category: "General consultation", situation: "Isolated fixture.",
  description: "Find a direction.", objectives: "A consultation.", consultation: "Google Meet",
};

const first = await check("/api/inquiries", 201, { body: idea });
const confirmation = await first.json();
assert.deepEqual(Object.keys(confirmation), ["reference"]);
assert.match(confirmation.reference, /^AX-[0-9A-F]{12}$/);
const replay = await check("/api/inquiries", 200, { body: idea });
assert.deepEqual(await replay.json(), confirmation);
await check("/api/inquiries", 409, { body: { ...idea, requestId: randomUUID() } });
await check("/api/inquiries", 201, { body: project });
await check("/api/inquiries", 201, { body: guidance });
await check("/api/inquiries", 429, { body: { ...idea, requestId: randomUUID() } });
const availability = await (await check("/api/inquiries/availability", 200)).json();
assert.equal(availability.mode, "request");
assert.equal(availability.signInRequired, true);
assert.equal(availability.slots.length, 0);
await check("/api/meetings/request", 401, { body: { title: "Fixture", preferredAt: "2030-01-01T10:00:00Z" } });

const projectDetail = await (await check(inquiryApi + "/" + project.requestId, 200, { cookie })).json();
assert.deepEqual(projectDetail.services.map(({ label, serviceId }) => ({ label, serviceId })), [{ label: choice.label, serviceId: published.id }]);
const guidanceDetail = await (await check(inquiryApi + "/" + guidance.requestId, 200, { cookie })).json();
assert.equal(guidanceDetail.inquiry.consultation, "Google Meet");

const detail = inquiryApi + "/" + idea.requestId;
const patch = async (body) => check(detail, body.action === "note" ? 201 : 200, { cookie, method: "PATCH", body });
const tomorrow = new Date(Date.now() + 86400000).toISOString();
await patch({ action: "update", changes: { stage: "contacted", priority: "high", assigneeId, followUpAt: tomorrow } });
await patch({ action: "note", content: "Private internal fixture note." });
await patch({ action: "update", changes: { stage: "qualified" } });
await patch({ action: "update", changes: { stage: "proposal" } });
await check("/api/admin/leads/" + idea.requestId, 400, { cookie, method: "PATCH", body: { status: "won" } });
await check(detail + "/meeting", 409, { cookie, body: {
  title: "Isolated Google Meet", startsAt: tomorrow, durationMinutes: 30, timeZone: "UTC",
} });

const today = new Date().toISOString().slice(0,10);
const body = { project: { name: "Converted fixture project", service: "Consultation", start: today, target: today } };
const conversions = await Promise.all([check(detail + "/convert", 200, { cookie, body }), check(detail + "/convert", 200, { cookie, body })]);
const [client, replayConversion] = await Promise.all(conversions.map((response) => response.json()));
assert.deepEqual(client, replayConversion);
assert.ok(client.clientId && client.projectId);
const clientList = (await (await check("/api/clients", 200, { cookie })).json()).clients;
assert.equal(clientList.filter(({ email }) => email === idea.email).length, 1);
const projects = (await (await check("/api/projects", 200, { cookie })).json()).projects;
assert.equal(projects.filter(({ id }) => id === client.projectId).length, 1);

const updated = await (await check(detail, 200, { cookie })).json();
assert.equal(updated.inquiry.stage, "converted");
assert.equal(updated.inquiry.assigneeId, assigneeId);
assert.equal(updated.inquiry.priority, "high");
assert.equal(updated.notes.length, 1);
assert.equal(updated.activity.filter(({ kind }) => kind === "conversion").length, 1);

const analytics = await (await check(inquiryApi + "/analytics?from=" + today + "&to=" + today, 200, { cookie })).json();
assert.equal(analytics.metrics.total, 3);
assert.equal(analytics.metrics.qualified, 1);
assert.equal(analytics.metrics.proposals, 1);
assert.equal(analytics.metrics.converted, 1);
assert.equal(analytics.metrics.convertedClients, 1);
assert.equal(analytics.metrics.convertedFunnel, 1);
assert.equal(analytics.visitor.viewed, 1);
assert.equal(analytics.visitor.submitted, 1);
assert.equal(analytics.services[0].label, choice.label);
assert.ok(analytics.markets.find((row) => row.label === "Domestic" && row.value === 2));
assert.ok(analytics.sources.find((row) => row.label === "fixture-source" && row.value === 1));

const list = await (await check(inquiryApi + "?type=PROJECT&q=Fixture&size=1", 200, { cookie })).json();
assert.equal(list.total, 1);
assert.equal(list.inquiries[0].id, project.requestId);
const csv = await (await check(inquiryApi + "?export=csv&stage=converted", 200, { cookie })).text();
assert.ok(csv.includes("'=Fixture Formula") && !csv.includes(project.name));

const matchingAccount = clientList.find(({ email }) => email === `client-${stamp}@example.com`);
assert.ok(matchingAccount);
const linked = await check(inquiryApi + "/" + project.requestId + "/convert", 200, { cookie, body: { clientId: matchingAccount.id } });
assert.deepEqual(await linked.json(), { clientId: matchingAccount.id, projectId: null });
const guidanceRoute = inquiryApi + "/" + guidance.requestId;
await check(guidanceRoute, 400, { cookie, method: "PATCH", body: { action: "update", changes: { stage: "lost" } } });
await check(guidanceRoute, 200, { cookie, method: "PATCH", body: { action: "update", changes: { stage: "lost", lostReason: "Fixture closed." } } });
const final = await (await check(guidanceRoute, 200, { cookie })).json();
assert.equal(final.inquiry.lostReason, "Fixture closed.");
console.log("Verified anonymous submission, published catalogue mapping, consultation fallback, admin workflow, atomic conversion, cohort analytics, and filtered CSV.");
