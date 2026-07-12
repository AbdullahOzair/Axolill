/**
 * Create (or promote) an admin. This is the ONLY way an admin comes into
 * existence — the website can never produce one.
 *
 *   npm run create-admin -- you@axonill.com --name "Your Name" --password "secret123"
 *   npm run create-admin -- you@axonill.com --remote        # production D1
 *
 * Behaviour:
 *   - user doesn't exist        -> creates the user + a password credential, role=admin
 *   - user exists (any role)    -> sets role=admin, and sets/replaces the password
 *                                  if --password is given
 *   - --password omitted        -> a strong password is generated and printed ONCE
 *
 * Admins sign in at /admin/login (email + password only — no signup, no Google).
 *
 * How it talks to D1: Drizzle builds the statements (type-safe against
 * lib/db/schema.ts) and `wrangler d1 execute` runs them, so it works against both
 * local and remote using the wrangler auth you already have.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import path from "node:path";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";

import { account, user } from "../lib/db/schema";

// wrangler doesn't expose ./bin/wrangler.js via package "exports", so resolve
// the file path directly rather than through require.resolve().
const WRANGLER_BIN = path.join(
  process.cwd(),
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js"
);

if (!existsSync(WRANGLER_BIN)) {
  console.error(
    `\n✖ Could not find wrangler at ${WRANGLER_BIN}\n  Run \`npm install\` first.\n`
  );
  process.exit(1);
}

/* ---------------------------------- args ---------------------------------- */

const argv = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}

const remote = argv.includes("--remote");
const email = argv.find((a) => !a.startsWith("--") && a.includes("@"));
const nameArg = flag("name");
const passwordArg = flag("password");

if (!email) {
  console.error(
    [
      "",
      "Usage: npm run create-admin -- <email> [--name <name>] [--password <password>] [--remote]",
      "",
      '  npm run create-admin -- you@axonill.com --name "Your Name" --password "secret123"',
      "  npm run create-admin -- you@axonill.com --remote",
      "",
      "  --password may be omitted; one will be generated and printed once.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const target = email.trim().toLowerCase();

if (passwordArg && passwordArg.length < 8) {
  console.error("\n✖ Password must be at least 8 characters.\n");
  process.exit(1);
}

/* ------------------------------ sql execution ------------------------------ */

/** Quote a value as a SQL literal. Params come from Drizzle, not raw input. */
function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return String(Math.floor(value.getTime() / 1000));
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Drizzle emits `?` placeholders; wrangler's CLI can't bind params, so inline. */
function inline(sql: string, params: unknown[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => literal(params[i++]));
}

type Row = Record<string, unknown>;

function execute(sql: string, params: unknown[]): Row[] {
  const command = inline(sql, params);

  /*
   * Invoke wrangler's JS entry with the current Node binary rather than `npx`.
   * Going through a shell (needed to run npx.cmd on Windows) would word-split
   * the SQL string into separate argv entries and wrangler would reject it.
   */
  const args = [
    WRANGLER_BIN,
    "d1",
    "execute",
    "DB",
    remote ? "--remote" : "--local",
    "--json",
    "--command",
    command,
  ];

  let stdout: string;
  try {
    stdout = execFileSync(process.execPath, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string };
    console.error("\n✖ wrangler failed:\n");
    console.error(err.stderr || err.stdout || String(error));
    process.exit(1);
  }

  const parsed = JSON.parse(stdout) as Array<{ results?: Row[] }>;
  return parsed[0]?.results ?? [];
}

/** Query builder only — the callback never runs; we use `.toSQL()`. */
const qb = drizzle(async () => ({ rows: [] }));

/* --------------------------------- script --------------------------------- */

// tsx compiles this to CJS (no "type":"module" in package.json), where top-level
// await is unsupported — so the body lives in an async main().
async function main() {
const where = remote ? "remote (production)" : "local";
const password = passwordArg ?? randomBytes(12).toString("base64url");
const generated = !passwordArg;

console.log(`\nTarget: ${target}  (${where} D1)`);

// 1. Does the user exist?
const selectUser = qb
  .select({ id: user.id, email: user.email, name: user.name, role: user.role })
  .from(user)
  .where(eq(user.email, target))
  .toSQL();

const existing = execute(selectUser.sql, selectUser.params)[0] as
  | { id: string; email: string; name: string; role: string }
  | undefined;

const now = new Date();
const hash = await hashPassword(password);

let userId: string;

if (existing) {
  userId = existing.id;
  console.log(`  Found existing user "${existing.name}" (role=${existing.role})`);

  const promote = qb
    .update(user)
    .set({ role: "admin", updatedAt: now })
    .where(eq(user.id, userId))
    .toSQL();
  execute(promote.sql, promote.params);
  console.log("  → role set to admin");
} else {
  userId = randomUUID();
  const insertUser = qb
    .insert(user)
    .values({
      id: userId,
      name: nameArg ?? target.split("@")[0],
      email: target,
      emailVerified: true, // provisioned by staff, no verification mail to send
      role: "admin",
      createdAt: now,
      updatedAt: now,
    })
    .toSQL();
  execute(insertUser.sql, insertUser.params);
  console.log("  → created new user with role=admin");
}

// 2. Set the password credential (so they can sign in at /admin/login).
//    better-auth stores password logins as providerId="credential" with
//    accountId === userId. A Google-only user has no such row.
const credQuery = qb
  .select({ id: account.id, providerId: account.providerId })
  .from(account)
  .where(eq(account.userId, userId))
  .toSQL();
const accounts = execute(credQuery.sql, credQuery.params) as Array<{
  id: string;
  providerId: string;
}>;
const credential = accounts.find((a) => a.providerId === "credential");

if (credential) {
  if (passwordArg || !existing) {
    const upd = qb
      .update(account)
      .set({ password: hash, updatedAt: now })
      .where(eq(account.id, credential.id))
      .toSQL();
    execute(upd.sql, upd.params);
    console.log("  → password updated");
  } else {
    console.log("  → existing password kept (pass --password to change it)");
  }
} else {
  const ins = qb
    .insert(account)
    .values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
      createdAt: now,
      updatedAt: now,
    })
    .toSQL();
  execute(ins.sql, ins.params);
  console.log("  → password credential created");
}

const showPassword = generated && (!existing || !credential);

console.log(
  [
    "",
    "✓ Admin ready.",
    "",
    `    email:    ${target}`,
    showPassword ? `    password: ${password}   ← save this, shown once` : "",
    "",
    "  Sign in at /admin/login (email + password only).",
    "",
  ]
    .filter(Boolean)
    .join("\n")
);
}

main().catch((error) => {
  console.error("\n✖ create-admin failed:\n", error);
  process.exit(1);
});
