"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. Talks to the /api/auth/[...all] route on the same
 * origin, so no baseURL is needed.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
