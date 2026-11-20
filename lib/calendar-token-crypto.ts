const PREFIX = "v1.";
const text = new TextEncoder();

export function isSealedCalendarToken(value: string) {
  return value.startsWith(PREFIX);
}

async function importKey(hex: string) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error("Invalid Calendar token key");
  const key = Uint8Array.from(hex.match(/../g)!, (byte) => Number.parseInt(byte, 16));
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function sealCalendarToken(value: string, secret: string | undefined, context: string) {
  if (!secret) return value;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: text.encode(context) },
    await importKey(secret),
    text.encode(value)
  );
  return PREFIX + toBase64(iv) + "." + toBase64(new Uint8Array(ciphertext));
}

export async function openCalendarToken(value: string, secret: string | undefined, context: string) {
  if (!isSealedCalendarToken(value)) return value;
  if (!secret) throw new Error("Calendar token key is missing");
  const [, iv, ciphertext, extra] = value.split(".");
  if (!iv || !ciphertext || extra !== undefined) throw new Error("Invalid Calendar token envelope");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv), additionalData: text.encode(context) },
    await importKey(secret),
    fromBase64(ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}
