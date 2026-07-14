"use client";

import * as React from "react";

type AuthResult<T> = {
	data: T | null;
	error: { message: string } | null;
};

type SessionResult = AuthResult<{
	user: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
		role?: string | null;
	};
	session?: unknown;
}>;

const AUTH_BASE = "/api/auth";

async function parseResponse<T>(response: Response): Promise<AuthResult<T>> {
	let payload: unknown = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const message =
			typeof payload === "object" && payload && "message" in payload
				? String((payload as { message?: unknown }).message)
				: typeof payload === "object" && payload && "error" in payload
					? String((payload as { error?: unknown }).error)
					: `Request failed with status ${response.status}`;
		return { data: null, error: { message } };
	}

	return { data: payload as T, error: null };
}

async function postJson<T>(path: string, body?: unknown): Promise<AuthResult<T>> {
	const response = await fetch(`${AUTH_BASE}${path}`, {
		method: "POST",
		credentials: "include",
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});

	return parseResponse<T>(response);
}

async function getSession(): Promise<SessionResult> {
	const response = await fetch(`${AUTH_BASE}/get-session`, {
		method: "GET",
		credentials: "include",
	});

	return parseResponse<SessionResult["data"]>(response);
}

function useSession() {
	const [data, setData] = React.useState<SessionResult["data"]>(null);
	const [error, setError] = React.useState<SessionResult["error"]>(null);
	const [isPending, setIsPending] = React.useState(true);

	React.useEffect(() => {
		let active = true;

		const load = async () => {
			const result = await getSession();
			if (!active) return;
			setData(result.data);
			setError(result.error);
			setIsPending(false);
		};

		void load();

		return () => {
			active = false;
		};
	}, []);

	return { data, error, isPending };
}

const signIn = {
	async email({ email, password }: { email: string; password: string }) {
		return postJson<unknown>("/sign-in/email", { email, password });
	},
	async social({
		provider,
		callbackURL,
	}: {
		provider: string;
		callbackURL?: string;
	}) {
		const result = await postJson<{ redirect: boolean; url?: string }>(
			"/sign-in/social",
			{ provider, callbackURL }
		);

		if (result.error) return result;

		if (result.data?.redirect && result.data.url) {
			window.location.assign(result.data.url);
		}

		return result;
	},
};

const signUp = {
	async email({
		name,
		email,
		password,
	}: {
		name: string;
		email: string;
		password: string;
	}) {
		return postJson<unknown>("/sign-up/email", { name, email, password });
	},
};

async function signOut() {
	return postJson<unknown>("/sign-out");
}

/**
 * Browser-side auth client. Talks to the /api/auth/[...all] route on the same
 * origin, so no baseURL is needed.
 */
export const authClient = {
	getSession,
	signIn,
	signUp,
	signOut,
	useSession,
};

export { signIn, signUp, signOut, useSession };
