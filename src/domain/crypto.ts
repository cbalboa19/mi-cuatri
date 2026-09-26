// Cifrado con contraseña (WebCrypto: PBKDF2-SHA256 + AES-GCM 256).
// Funciona igual en el navegador y en Node (script de cifrado y tests).
// Este archivo no importa nada para poder usarse desde scripts de Node sin bundler.

export interface EncryptedPayload {
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  /** base64 */
  salt: string;
  /** base64 */
  iv: string;
  /** base64 (texto cifrado + tag de AES-GCM) */
  data: string;
}

export const DEFAULT_ITERATIONS = 600_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const randomBytes = (n: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(n));

/** Clave AES no exportable derivada de la contraseña (se puede guardar en IndexedDB). */
export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptWithKey(
  value: unknown,
  key: CryptoKey,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: iterations, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/** Descifra con una clave ya derivada. Lanza si la clave no es la correcta o los datos están alterados. */
export async function decryptWithKey(payload: EncryptedPayload, key: CryptoKey): Promise<unknown> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
  return JSON.parse(dec.decode(plain));
}

/** Deriva la clave del payload a partir de la contraseña y descifra. Devuelve también la clave. */
export async function decryptWithPassword(
  payload: EncryptedPayload,
  password: string,
): Promise<{ value: unknown; key: CryptoKey }> {
  const key = await deriveKey(password, fromBase64(payload.salt), payload.iter);
  return { value: await decryptWithKey(payload, key), key };
}

/** Token de registro en el servidor de avisos, derivado de la clave (el servidor solo guarda su hash). */
export async function notifyToken(password: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(`mi-cuatri-notify:${password.trim()}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
