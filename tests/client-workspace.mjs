import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture = path.resolve(process.env.AXONILL_TEST_FIXTURE ?? "");
const root = fileURLToPath(new URL("../", import.meta.url));
const origin = new URL(process.env.AXONILL_TEST_URL ?? "http://localhost:8791");
const api = "/api/portal/workspace";
const quoteApi = "/api/admin/quotations";
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
assert.equal(path.dirname(fixture), path.join(root, ".wrangler"));
assert.ok(path.basename(fixture).startsWith("security-check-"));
const config = JSON.parse(readFileSync(path.join(fixture, "wrangler.json"), "utf8"));
assert.ok(config.workers_dev === false && !config.routes && !config.account_id);

async function request(route, options = {}) {
  const { expected = 200, method = "GET", cookies, body, foreign = false } = options;
  const headers = new Headers();
  if (cookies) headers.set("cookie", cookies.join("; "));
  if (method !== "GET") headers.set("origin", foreign ? "https://foreign.example" : origin.origin);
  if (body !== undefined && !(body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(new URL(route, origin), { method, headers, redirect: "manual",
    body: body === undefined || body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;
  const statuses = Array.isArray(expected) ? expected : [expected];
  assert.ok(statuses.includes(response.status), method + " " + route.split("?")[0] + ": received " + response.status +
    ", expected " + statuses.join("/") + (data?.error ? " (" + data.error + ")" : ""));
  return { response, data };
}

const cookieHeader = (response) => response.headers.getSetCookie().map((entry) => entry.split(";")[0]);
async function client(name) {
  const outcome = await request("/api/auth/sign-up/email", { method: "POST",
    body: { name, email: "workspace-" + randomUUID() + "@example.com", password: randomBytes(24).toString("hex") } });
  const id = outcome.data.user.id;
  const cookies = cookieHeader(outcome.response);
  assert.ok(cookies.length && id);
  return { id, cookies, get: (route, options = {}) => request(route, { ...options, cookies }),
    send: (route, method, body, expected = 200) => request(route, { method, body, expected, cookies }) };
}

await request(api, { expected: 401 });
await request("/portal", { expected: 307 });
const adminCredentials = JSON.parse(readFileSync(path.join(fixture, "quotation-test-admin.json"), "utf8"));
const adminCookies = cookieHeader((await request("/api/auth/sign-in/email", { method: "POST", body: adminCredentials })).response);
const admin = (route, options = {}) => request(route, { ...options, cookies: adminCookies });
const staff = (route, method, body, expected = 200) => admin(route, { method, body, expected });
const first = await client("Workspace test client");
const second = await client("Different test client");
await first.get("/portal");
const catalogueName = "Workspace service " + randomUUID().slice(0, 8);
const catalogue = await staff("/api/services", "POST", { icon: "CodeXml", title: catalogueName, items: ["Planning", "Development"], published: true }, 201);
const selected = (await first.get(api)).data.catalog.filter((item) => item.serviceId === catalogue.data.service.id).map((item) => item.key);
assert.equal(selected.length, 2);

const brief = {
  type: "PROJECT", title: "Client website", description: "We need a website for our studio.", objectives: "Bring in more enquiries",
  services: selected, currency: "PKR", budget: 38000, timeline: "Within one month", consultation: true,
};
const draft = (await first.send(api + "/requests", "POST", { type: "PROJECT" }, 201)).data;
const id = draft.id;
const route = api + "/requests/" + id;
const thread = "/api/admin/portal-requests/" + id;
await admin(thread, { expected: 404 });
await second.send(route, "PATCH", { version: 0, input: brief }, 404);
await first.get(route, { method: "PATCH", body: { version: 0, input: brief }, expected: 403, foreign: true });
await first.send(route, "PATCH", { version: 0, input: brief });
await first.send(route, "PATCH", { version: 0, input: brief }, 409);
const before = (await first.get(api + "?request=" + id)).data.requests.find((row) => row.id === id);
assert.equal(before.version, 1);
assert.equal(before.status, "draft");
assert.deepEqual(before.input.services, brief.services);
const fake = new FormData();
fake.set("file", new Blob(["unknown content"], { type: "application/pdf" }), "wrong.pdf");
await first.send(route + "/attachments", "POST", fake, 400);
const file = new FormData();
file.set("file", new Blob(["%PDF-1.4\nWorkspace fixture"], { type: "application/pdf" }), "studio-brief.pdf");
const fileId = (await first.send(route + "/attachments", "POST", file, 201)).data.id;
assert.match(await (await first.get(route + "/attachments/" + fileId)).response.text(), /Workspace fixture/);
await second.get(route + "/attachments/" + fileId, { expected: 404 });

const submitted = await Promise.all([
  first.send(route + "/submit", "POST", { version: 1, input: brief }, [200, 201]),
  first.send(route + "/submit", "POST", { version: 1, input: brief }, [200, 201]),
]);
assert.equal(submitted[0].data.reference, submitted[1].data.reference);
assert.match(submitted[0].data.reference, /^AXN-REQ-/);
const workspace = async () => (await first.get(api + "?request=" + id)).data;
const current = async () => (await workspace()).requests.find((row) => row.id === id);
assert.equal((await current()).status, "submitted");
assert.equal((await current()).services.length, 2);
assert.equal((await admin("/api/admin/inquiries/" + id)).data.inquiry.source, "portal_workspace");
assert.equal((await admin(thread)).data.attachments.length, 1);
await admin(thread + "/attachments/" + fileId);
await first.get(thread, { expected: 403 });

await staff(thread + "/status", "PATCH", { state: "under_review" });
await staff(thread + "/messages", "POST", { text: "Could you share your brand guidelines?", action: "needs_info" }, 201);
await staff("/api/admin/inquiries/" + id, "PATCH", { action: "note", content: "PRIVATE INTERNAL NOTE" }, 201);
assert.equal((await current()).status, "needs_info");
assert.doesNotMatch(JSON.stringify(await workspace()), /PRIVATE INTERNAL NOTE/);
await first.send(route + "/messages", "POST", { text: "We will share guidelines this week.", action: "response" }, 201);
assert.equal((await current()).status, "under_review");
assert.equal((await admin(thread)).data.events.find((event) => event.kind === "client_message").readAt, null);
await staff(thread + "/read", "POST", {});
assert.ok((await admin(thread)).data.events.find((event) => event.kind === "client_message").readAt);
assert.ok((await workspace()).notifications.some((entry) => entry.title === "Axonill needs more information"));
await first.send(api + "/notifications", "POST", {});
assert.ok((await workspace()).notifications.every((entry) => entry.read));

assert.deepEqual((await first.get(api + "/availability")).data, { mode: "request", slots: [] });
const meetingPath = "/api/meetings/request";
const firstSlot = new Date(Date.now() + 3 * 86400000).toISOString();
const secondSlot = new Date(Date.now() + 4 * 86400000).toISOString();
const appointment = (await first.send(meetingPath, "POST", { requestId: id, title: "Project kickoff discussion", preferredAt: firstSlot }, 201)).data.meeting;
await first.send(meetingPath, "POST", { requestId: id, title: "Duplicate overlapping request", preferredAt: firstSlot }, 400);
await second.send("/api/meetings/" + appointment.id, "PATCH", { action: "cancel" }, 404);
await first.send("/api/meetings/" + appointment.id, "PATCH", { action: "reschedule", startsAt: secondSlot });
assert.equal((await current()).meetings[0].requestedChangeAt, null);
assert.ok((await current()).meetings[0].scheduledAt.startsWith(secondSlot.slice(0, 16)));
await staff("/api/meetings/" + appointment.id, "PATCH", { action: "confirm", startsAt: secondSlot }, 409);
assert.equal((await current()).meetings[0].status, "requested");
await first.send("/api/meetings/" + appointment.id, "PATCH", { action: "cancel" });
assert.equal((await current()).meetings[0].status, "cancelled");

const { data: options } = await admin(quoteApi + "/options?source=" + id);
assert.equal(options.input.clientId, first.id);
const quoteInput = { ...options.input, title: "Portal quotation", privateNotes: "PRIVATE QUOTATION NOTE",
  scope: "Website development", lines: [{ ...options.input.lines[0], name: "Website build", unitPrice: 3500000, cost: 1000000 }] };
const quote = (await staff(quoteApi, "POST", quoteInput, 201)).data.quote;
const details = api + "/quotations/" + quote.id;
await first.get(details, { expected: 404 });
const command = async (q, action, values = {}) => (await staff(quoteApi + "/" + q.id, "POST", { action, version: q.version, ...values })).data;
async function sendQuote(q) {
  const pending = (await command(q, "submit")).quote;
  const approved = (await command(pending, "approve")).quote;
  await first.get(api + "/quotations/" + q.id, { expected: 404 });
  const key = await command(approved, "share", { days: 2 });
  const sent = (await command(approved, "sent", { note: "Confirmed fixture delivery" })).quote;
  return { ...key, sent };
}
const original = await sendQuote(quote);
assert.equal((await current()).status, "quote_ready");
const view = (await first.get(details)).data.quote;
assert.equal(view.scope, "Website development");
assert.doesNotMatch(JSON.stringify(view), /PRIVATE|"cost"|tokenHash|codeHash/);
await second.get(details, { expected: 404 });
await first.send(details, "POST", { action: "accept", code: "0".repeat(32) }, 403);
await first.send(details, "POST", { action: "revise", code: original.code, comment: "Please update scope" });
assert.equal((await current()).status, "revision");
const revised = (await command((await admin(quoteApi + "/" + quote.id)).data.quote, "revision")).quote;
const sentRevision = await sendQuote(revised);
assert.equal((await workspace()).quotes.filter((item) => item.number === quote.number).length, 2);
const newDetails = api + "/quotations/" + revised.id;
const pdf = (await first.get(newDetails + "/pdf")).response;
assert.match(pdf.headers.get("content-type") ?? "", /application\/pdf/);
assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
await second.get(newDetails + "/pdf", { expected: 404 });
await first.send(newDetails, "POST", { action: "accept", code: sentRevision.code, comment: "Approved" });
assert.equal((await current()).status, "accepted");
assert.equal((await current()).projectId, null);
await first.send(route + "/cancel", "POST", undefined, 409);
const convert = "/api/admin/inquiries/" + id + "/convert";
const newProject = { name: "New client workspace", service: "Website build", start: "2027-01-01", target: "2027-02-01" };
await staff(convert, "POST", { clientId: second.id, project: newProject }, 400);
const { projectId } = (await staff(convert, "POST", { project: newProject })).data;
assert.ok(projectId);
assert.equal((await current()).status, "created");
assert.equal((await current()).projectId, projectId);
assert.equal((await second.get("/portal/project/" + projectId, { expected: 404 })).response.status, 404);
await first.get("/portal/project/" + projectId);
await first.get("/portal/requests/" + id);
assert.ok((await workspace()).notifications.some((item) => item.title === "Your project workspace is ready"));

const other = (await second.send(api + "/requests", "POST", { type: "GUIDANCE" }, 201)).data;
await second.send(api + "/requests/" + other.id, "DELETE");
assert.equal((await second.get(api)).data.requests.length, 0);
const guidance = (await second.send(api + "/requests", "POST", { type: "GUIDANCE" }, 201)).data;
const guidancePath = api + "/requests/" + guidance.id;
await second.send(guidancePath + "/submit", "POST", { version: guidance.version, input: {
  type: "GUIDANCE", description: "We need help deciding how to reach customers.", area: "Growing my business", communication: "Email",
} }, 201);
const idea = (await second.send(api + "/requests", "POST", { type: "IDEA" }, 201)).data;
await second.send(api + "/requests/" + idea.id + "/submit", "POST", { version: idea.version, input: {
  type: "IDEA", title: "Community calendar", description: "A way to discover nearby events.",
  objectives: "Neighbors miss local events.", audience: "Local residents",
} }, 201);
await second.send(guidancePath + "/cancel", "POST");
const separate = (await second.get(api)).data.requests;
assert.equal(separate.length, 2);
assert.equal(separate.find((row) => row.id === guidance.id).status, "cancelled");
assert.equal(separate.find((row) => row.id === idea.id).status, "submitted");
if (process.argv.includes("--active-project")) {
  const projectApi = "/api/projects/" + projectId;
  const ws = projectApi + "/workspace";
  const client = (data, expected = 200) => first.send(ws, "POST", data, expected);
  const manage = (data, expected = 200) => staff(ws, "POST", data, expected);
  const read = async () => (await first.get(ws)).data;
  const add = (kind, data, expected = 201) => client({ action: "entry", input: { kind, ...data } }, expected);
  const publish = (kind, data) => manage({ action: "entry", input: { kind, ...data } }, 201);
  const teamPlan = [
    { name: "Discovery", description: "Confirm project scope", status: "completed", weight: 25 },
    { name: "Build", description: "Design and implementation", status: "current", weight: 75 },
  ];
  const stagePlan = { status: "active", stages: teamPlan, modules: ["development", "design"],
    instructions: "Bank payment details provided by Axonill", supportCoverage: "Included support for launch questions", supportThrough: "2027-05-01" };
  assert.equal((await read()).config.status, "preparing");
  assert.equal((await read()).agreements[0].id, revised.id);
  await second.get(ws, { expected: 404 });
  await second.send(ws, "POST", { action: "entry", input: { kind: "message", body: "Cannot send" } }, 404);
  await client({ action: "settings", config: stagePlan, version: 0, note: "Staff only" }, 404);
  await manage({ action: "settings", config: stagePlan, version: 0, note: "Delivery stages agreed." });
  assert.equal((await read()).progress, 25);
  await manage({ action: "settings", config: { ...stagePlan, target: "2027-02-11" }, version: 1, note: "Scope clarifications move the delivery date." });
  assert.ok((await read()).events.some((item) => item.data.body.includes("2027-02-11")));
  const anotherProject = (await staff("/api/projects", "POST", { clientId: first.id, name: "Another project", service: "Branding",
    startDate: "2027-01-10", targetDate: "2027-03-10" }, 201)).data.project;
  assert.equal((await read()).projects.length, 2);
  await first.get("/portal/projects");
  await first.get("/portal/project/" + projectId + "/milestones");
  await first.get("/portal/project/" + anotherProject.id);
  const milestone = (await staff(projectApi + "/milestones", "POST", { title: "First delivery", description: "Review this preview",
    dueDate: "2027-02-01", status: "awaiting_approval" }, 201)).data.milestone;
  const asset = async (sender, name, opts = {}) => {
    const data = new FormData();
    data.set("file", new Blob(["%PDF-1.4\nProject fixture test"], { type: "application/pdf" }), name);
    for (const [key, value] of Object.entries(opts)) data.set(key, value);
    return (await sender(projectApi + "/files", "POST", data, 201)).data.file;
  };
  const hidden = await asset(staff, "internal.pdf", { milestoneId: milestone.id, visibility: "internal" });
  assert.ok(!(await read()).files.some((item) => item.id === hidden.id));
  await first.get(projectApi + "/files/" + hidden.id, { expected: 404 });
  assert.ok(!(await first.get(projectApi + "/files")).data.files.some((item) => item.id === hidden.id));
  const originalFile = await asset(staff, "First version.pdf", { milestoneId: milestone.id });
  const currentMilestone = async () => (await read()).milestones.find((item) => item.id === milestone.id);
  const oldVersion = (await currentMilestone()).reviewVersion;
  await client({ action: "review", id: milestone.id, version: oldVersion, status: "changes_requested", feedback: "Please revise." });
  const revisedFile = await asset(staff, "Second version.pdf", { milestoneId: milestone.id, previousVersionId: originalFile.id });
  await staff(projectApi + "/milestones/" + milestone.id, "PATCH", { status: "awaiting_approval" });
  await client({ action: "review", id: milestone.id, version: oldVersion, status: "approved" }, 409);
  await client({ action: "review", id: milestone.id, version: (await currentMilestone()).reviewVersion, status: "approved" });
  const reviews = (await read()).events.filter((item) => item.kind === "milestone_review");
  assert.equal(reviews.length, 2);
  assert.ok((await admin(ws)).data.notifications.some((item) => !item.read && item.title === "Client approved a milestone"));
  assert.deepEqual(reviews.find((item) => item.state === "approved").data.files, [revisedFile.id]);
  await second.get(projectApi + "/files/" + revisedFile.id, { expected: 404 });
  assert.equal((await first.get(projectApi + "/files/" + revisedFile.id + "?preview=1")).response.headers.get("content-type"), "application/pdf");
  await staff(projectApi + "/files/" + originalFile.id, "DELETE", undefined, 409);

  await staff("/api/invoices", "POST", { projectId, number: "UNVERIFIED-"+randomUUID(), amount: 500,
    currency: "PKR", dueDate: "2027-02-08", status: "paid" }, 400);
  const sendBill = async (quoteId, destination = projectId) => {
    const record = (await admin(quoteApi + "/" + quoteId)).data.quote;
    const conversion = await command(record, "invoice", { projectId: destination, due: "2027-02-08" });
    const invoiceId = conversion.invoiceId;
    assert.ok(invoiceId);
    await first.get(ws + "?document=invoice&entry=" + invoiceId, { expected: 404 });
    await staff("/api/invoices/" + invoiceId, "PATCH", { status: "sent" });
    return invoiceId;
  };
  const bill = await sendBill(revised.id);
  const paymentFile = await asset(first.send, "Proof.pdf");
  const paid = async (invoiceId, amount, reference) => {
    const proof = (await add("proof", { body: "Proof of payment", amount, reference, date: "2026-01-02", invoiceId, fileId: paymentFile.id })).data;
    assert.ok((await read()).events.some((item) => item.id === proof.id && item.state === "pending"));
    await manage({ action: "decision", id: proof.id, version: 0, state: "verified", receipt: "VER-" + reference, receivedOn: "2026-01-02" });
    return proof.id;
  };
  await paid(bill, "10000", "FIRST");
  const bills = async (id) => (await read()).invoices.find((item) => item.id === id);
  assert.equal((await bills(bill)).status, "sent");
  assert.equal((await bills(bill)).paid, 1000000);
  await paid(bill, "25000", "FINAL");
  assert.equal((await bills(bill)).status, "paid");
  assert.equal((await bills(bill)).balance, 0);
  const receiptId = (await bills(bill)).payments[0].id;
  await first.get(ws + "?document=receipt&entry=" + receiptId);
  await second.get(ws + "?document=receipt&entry=" + receiptId, { expected: 404 });
  await first.get(ws + "?document=invoice&entry=" + bill);

  const change = (await add("change", { title: "Add landing page", body: "Create a landing page for launch.", reason: "New offer" })).data;
  await manage({ action: "decision", id: change.id, version: 0, state: "approved", quoteId: revised.id }, 400);
  const extra = (await staff(quoteApi, "POST", { ...quoteInput, title: "Launch landing page", lines: [{ ...quoteInput.lines[0], unitPrice: 100000 }],
    discount: 0 }, 201)).data.quote;
  const extraSent = await sendQuote(extra);
  await manage({ action: "decision", id: change.id, version: 0, state: "awaiting_client", quoteId: extra.id, target: "2027-02-20" });
  assert.equal((await read()).financial[0].extras, 0);
  await first.send(api + "/quotations/" + extra.id, "POST", { action: "accept", code: extraSent.code });
  await manage({ action: "decision", id: change.id, version: 1, state: "approved", quoteId: extra.id, target: "2027-02-20" });
  assert.equal((await read()).financial[0].extras, 100000);
  assert.ok((await read()).project.targetDate.startsWith("2027-02-20"));
  await paid(await sendBill(extra.id), "1000", "ADD");

  const moduleEntry = (await publish("module", { module: "design", category: "Design review", title: "Landing page design", body: "Client review", needsReview: true })).data;
  await client({ action: "module_review", id: moduleEntry.id, version: 0, choice: "approved" });
  await client({ action: "module_review", id: moduleEntry.id, version: 0, choice: "approved" }, 409);
  await add("message", { body: "Client project message" });
  await publish("message", { body: "Thanks for the update." });
  assert.ok((await read()).notifications.some((item) => item.title === "New project message"));
  await client({ action: "read" });
  assert.ok((await read()).notifications.every((item) => item.read));
  const report = (await publish("report", { title: "Weekly update", body: "Completed initial implementation.", period: "weekly" })).data;
  await first.get(ws + "?document=report&entry=" + report.id);
  await publish("handover", { title: "Final handover", body: "Deployment and training details", fileId: revisedFile.id });
  const version = (await read()).settingsVersion;
  await manage({ action: "settings", config: { ...stagePlan, status: "completed", stages: teamPlan.map((stage) => ({ ...stage, status: "completed" })) },
    version, note: "Delivered and verified." });
  assert.equal((await read()).config.status, "completed");
  await add("feedback", { body: "The delivery went well.", scores: [5, 5, 5, 5], publishConsent: false });
  const support = (await add("support", { title: "Post-delivery question", body: "How do I update the title?" })).data;
  const supportQuote = (await staff(quoteApi, "POST", { ...quoteInput, title: "Extended support", discount: 0,
    lines: [{ ...quoteInput.lines[0], name: "Ongoing maintenance", recurring: true, unitPrice: 80000 }] }, 201)).data.quote;
  const supportSent = await sendQuote(supportQuote);
  await manage({ action: "decision", id: support.id, version: 0, state: "awaiting_client", quoteId: supportQuote.id, note: "Optional extended coverage." });
  assert.equal((await read()).events.find((item) => item.id === support.id).data.quoteId, supportQuote.id);
  await first.send(api + "/quotations/" + supportQuote.id, "POST", { action: "accept", code: supportSent.code });
  const recurringBill = await sendBill(supportQuote.id);
  const recurringData = await bills(recurringBill);
  assert.equal(recurringData.recurring, true);
  assert.equal(recurringData.minor, 80000);
  assert.equal((await read()).financial[0].monthly, 80000);
  await manage({ action: "decision", id: support.id, version: 1, state: "resolved", quoteId: supportQuote.id, note: "See the handover guide." });
  assert.ok((await read()).events.some((item) => item.id === support.id && item.state === "resolved"));
  console.log("Active project lifecycle passed, including version checks, partial receipts, scope approval, module reviews, handover and support.");
}
if (process.env.AXONILL_WORKSPACE_BROWSER === "1") writeFileSync(path.join(fixture, "workspace-browser.json"),
  JSON.stringify({ cookies: first.cookies, requestId: id, quoteId: revised.id, projectId }), { mode: 0o600 });
console.log("Portal workspace passed: auth, ownership, autosave and version checks, attachments, idempotent submission, admin review, messages, notifications, pending meeting changes, quotation revisions and PDFs, acceptance, project transition, and draft deletion.");
