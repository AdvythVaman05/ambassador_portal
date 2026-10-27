const encoder = new TextEncoder();
const iterations = 310_000;

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, count: number) {
  const passwordBytes = encoder.encode(password) as unknown as BufferSource;
  const safeSalt = salt as unknown as BufferSource;
  const material = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: safeSalt, iterations: count },
      material,
      256,
    ),
  );
}

/** Password hashes are deliberately versioned so their work factor can be upgraded later. */
export async function hashPassword(password: string) {
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${encode(salt)}$${encode(digest)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, countText, saltText, digestText] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || !countText || !saltText || !digestText) return false;
  const count = Number(countText);
  if (!Number.isSafeInteger(count) || count < 100_000) return false;
  const actual = await derive(password, decode(saltText), count);
  const expected = decode(digestText);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1)
    difference |= actual[index]! ^ expected[index]!;
  return difference === 0;
}
