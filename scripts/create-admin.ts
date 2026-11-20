/**
 * Create (or promote) an admin. This is the ONLY way an admin comes into
 * existence — the website can never produce one.
 *
 *   npm run create-admin -- you@axonill.com --name "Your Name"
 *   npm run create-admin -- you@axonill.com --remote        # production D1
 *
 * Behaviour:
 *   - user doesn't exist        -> creates the user + a password credential, role=admin
 *   - promotion               -> sets a fresh password and revokes old sessions
 *   - --rotate-password        -> replaces an existing admin's password
 *   - --reset-mfa              -> also clears two-factor enrollment for recovery
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
import { and, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";

import { account, session, twoFactor, user, verification } from "../lib/db/schema";

// wrangler doesn't expose ./bin/wrangler.js via package "exports", so resolve
// the file path directly rather than through require.resolve().
const WRANGLER_BIN = path.join(
  __dirname,
  "..",
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
const resetMfa = argv.includes("--reset-mfa");
const rotatePassword = Boolean(passwordArg || resetMfa || argv.includes("--rotate-password"));

if (!email) {
  console.error(
    [
      "",
      "Usage: npm run create-admin -- <email> [--name <name>] [--rotate-password] [--reset-mfa] [--remote]",
      "",
      '  npm run create-admin -- you@axonill.com --name "Your Name"',
      "  npm run create-admin -- you@axonill.com --remote",
      "",
      "  --password may be omitted; one will be generated and printed once.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const target = email.trim().toLowerCase();

if (argv.includes("--password") && (!passwordArg || passwordArg.startsWith("--") || passwordArg.length < 14)) {
  console.error("Admin passwords must be at least 14 characters.");
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

class ProvisioningError extends Error {}

function execute(sql: string, params: unknown[], extra: Array<{ sql: string; params: unknown[] }> = []): Row[] {
  const command = [{ sql, params }, ...extra].map((query) => inline(query.sql, query.params)).join(";\n");

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
    const result = error as { stderr?: string; stdout?: string; code?: string };
    const output = [result.stderr, result.stdout, result.code].filter(Boolean).join("\n");
    const reason = output.match(/\b(?:SQLITE_[A-Z_]+|D1_ERROR|EADDRINUSE|EACCES|EPERM|ENOENT|ECONNREFUSED|ECONNRESET)\b/)
      ?? output.match(/database is locked|no such table|no such column|syntax error|address already in use|cannot access the file|unexpected end of (?:JSON|input)/i);
    throw new ProvisioningError(
      reason ? `Wrangler could not execute the database batch (${reason[0]}).` : "Wrangler could not execute the database batch."
    );
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
  const selectUser = qb.select({ id: user.id, role: user.role })
    .from(user).where(eq(user.email, target)).toSQL();
  const existing = execute(selectUser.sql, selectUser.params)[0] as
    | { id: string; role: "admin" | "client" }
    | undefined;

  const userId = existing?.id ?? randomUUID();
  const selectAccount = qb.select({ id: account.id }).from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential"))).toSQL();
  const credential = existing
    ? execute(selectAccount.sql, selectAccount.params)[0] as { id: string } | undefined
    : undefined;

  if (existing?.role === "admin" && credential && !rotatePassword) {
    console.log("Admin already provisioned. Use --rotate-password to replace the password.");
    return;
  }

  const now = new Date();
  const password = passwordArg ?? randomBytes(24).toString("base64url");
  const hash = await hashPassword(password);
  const resetEnrollment = resetMfa || existing?.role === "client";

  const saveUser = existing
    ? qb.update(user).set({
        role: "admin",
        updatedAt: now,
        ...(resetEnrollment ? { twoFactorEnabled: false } : {}),
      }).where(eq(user.id, userId)).toSQL()
    : qb.insert(user).values({
        id: userId,
        name: nameArg ?? target.split("@")[0],
        email: target,
        emailVerified: true,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      }).toSQL();

  const savePassword = credential
    ? qb.update(account).set({ password: hash, updatedAt: now })
        .where(and(eq(account.userId, userId), eq(account.providerId, "credential"))).toSQL()
    : qb.insert(account).values({
        id: randomUUID(), accountId: userId, userId,
        providerId: "credential", password: hash, createdAt: now, updatedAt: now,
      }).toSQL();

  const writes = [
    savePassword,
    qb.delete(session).where(eq(session.userId, userId)).toSQL(),
    qb.delete(verification).where(and(
      eq(verification.value, userId),
      or(like(verification.identifier, "trust-device-%"), like(verification.identifier, "2fa-%"))
    )).toSQL(),
  ];
  if (resetEnrollment) {
    writes.push(qb.delete(twoFactor).where(eq(twoFactor.userId, userId)).toSQL());
  }

  execute(saveUser.sql, saveUser.params, writes);

  console.log(`Admin ready for ${target} (${remote ? "production" : "local"} D1).`);
  if (!passwordArg) console.log(`Generated password (shown once): ${password}`);
}

main().catch((error: unknown) => {
  if (error instanceof ProvisioningError) console.error(error.message);
  console.error("Admin provisioning failed. Check the database and migration status.");
  process.exitCode = 1;
});
