import { describe, expect, it } from 'vitest';
import { decryptWithKey, decryptWithPassword, deriveKey, encryptWithKey, fromBase64, randomBytes, toBase64 } from './crypto';

// Pocas iteraciones para que los tests sean rápidos (en producción son 600.000).
const ITER = 1000;

async function encrypt(value: unknown, password: string) {
  const salt = randomBytes(16);
  return encryptWithKey(value, await deriveKey(password, salt, ITER), salt, ITER);
}

describe('crypto', () => {
  it('round-trips with the right password', async () => {
    const payload = await encrypt({ hola: 'mundo', n: [1, 2] }, 'abcd-efgh');
    expect(payload).toMatchObject({ v: 1, kdf: 'PBKDF2-SHA256', iter: ITER });
    expect(payload.data).not.toContain('mundo');
    const { value, key } = await decryptWithPassword(payload, 'abcd-efgh');
    expect(value).toEqual({ hola: 'mundo', n: [1, 2] });
    expect(await decryptWithKey(payload, key)).toEqual(value);
  });

  it('fails with a wrong password', async () => {
    const payload = await encrypt({ a: 1 }, 'correcta');
    await expect(decryptWithPassword(payload, 'incorrecta')).rejects.toThrow();
  });

  it('fails if the data was tampered with', async () => {
    const payload = await encrypt({ a: 1 }, 'clave');
    const bytes = fromBase64(payload.data);
    bytes[0] = bytes[0]! ^ 1;
    await expect(decryptWithPassword({ ...payload, data: toBase64(bytes) }, 'clave')).rejects.toThrow();
  });

  it('re-encrypting with the same salt keeps the stored key valid', async () => {
    const salt = randomBytes(16);
    const key = await deriveKey('clave', salt, ITER);
    const v1 = await encryptWithKey({ v: 1 }, key, salt, ITER);
    const v2 = await encryptWithKey({ v: 2 }, await deriveKey('clave', fromBase64(v1.salt), v1.iter), salt, ITER);
    expect(v2.iv).not.toBe(v1.iv);
    expect(await decryptWithKey(v2, key)).toEqual({ v: 2 });
  });

  it('encodes base64 both ways', () => {
    const b = new Uint8Array([0, 1, 254, 255]);
    expect([...fromBase64(toBase64(b))]).toEqual([0, 1, 254, 255]);
  });
});
