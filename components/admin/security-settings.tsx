"use client";

import { useState, type FormEvent } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Enrollment = { setupKey: string; backupCodes: string[] };

export function SecuritySettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [backupCodes, setBackupCodes] = useState<string[]>();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      if (enrollment) {
        const result = await authClient.twoFactor.verify(code.trim());
        if (result.error) return setError(result.error.message);
        setBackupCodes(enrollment.backupCodes);
        setEnrollment(undefined);
        setCode("");
        setEnabled(true);
      } else if (enabled) {
        const result = await authClient.twoFactor.disable(password);
        if (result.error) return setError(result.error.message);
        setBackupCodes(undefined);
        setEnabled(false);
      } else {
        const result = await authClient.twoFactor.enable(password);
        if (result.error) return setError(result.error.message);
        const setupKey = result.data && new URL(result.data.totpURI).searchParams.get("secret");
        if (!setupKey || !result.data) return setError("Could not start authenticator setup.");
        setEnrollment({ setupKey, backupCodes: result.data.backupCodes });
      }
    } catch {
      setError("Could not update two-factor authentication. Try again.");
    } finally {
      setPassword("");
      setPending(false);
    }
  }

  return (
    <AdminPage title="Security">
      <section className="max-w-lg space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Two-factor authentication</h2>
        <p className="text-sm text-muted-foreground">
          {enabled ? "Enabled for your admin account." : "Add an authenticator app to your admin sign-in."}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {enrollment ? (
            <>
              <p className="text-sm">Add a time-based account named Axonill in your authenticator app and enter this setup key.</p>
              <code className="block select-all break-all rounded bg-muted p-2">{enrollment.setupKey}</code>
              <Label htmlFor="mfa-code">Authenticator code</Label>
              <Input id="mfa-code" required inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
            </>
          ) : (
            <>
              <Label htmlFor="mfa-password">Current password</Label>
              <Input id="mfa-password" required type="password" autoComplete="current-password"
                value={password} onChange={(event) => setPassword(event.target.value)} />
            </>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} variant={enabled ? "outline" : "default"}>
            {enrollment ? "Verify and enable" : enabled ? "Disable two-factor authentication" : "Set up authenticator"}
          </Button>
        </form>
        {backupCodes && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Recovery codes</h3>
            <p className="text-sm text-muted-foreground">Save these securely. Each code can be used once.</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((backup) => <li key={backup}>{backup}</li>)}
            </ul>
            <Button variant="outline" onClick={() => setBackupCodes(undefined)}>Done</Button>
          </div>
        )}
      </section>
    </AdminPage>
  );
}
