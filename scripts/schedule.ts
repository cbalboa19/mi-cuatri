// Cifra / descifra el horario. Se ejecuta con Node (>= 22.18, que entiende TypeScript):
//   npm run schedule:encrypt   local/schedule.json  → src/config/schedule.enc.json
//   npm run schedule:decrypt   src/config/schedule.enc.json → local/schedule.json
// La clave se lee de local/schedule.key (se crea la primera vez).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  DEFAULT_ITERATIONS,
  decryptWithPassword,
  deriveKey,
  encryptWithKey,
  fromBase64,
  randomBytes,
  type EncryptedPayload,
} from '../src/domain/crypto.ts';
import { parseSchedulePayload } from '../src/domain/schedule.ts';

const PLAIN = 'local/schedule.json';
const KEY_FILE = 'local/schedule.key';
const ENC = 'src/config/schedule.enc.json';

/** Clave legible tipo "k7mq-2xpa-9dhe" (~62 bits), sin caracteres que se confundan. */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return [0, 4, 8].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

function readPassword(): string {
  if (!existsSync(KEY_FILE)) {
    mkdirSync('local', { recursive: true });
    writeFileSync(KEY_FILE, generatePassword() + '\n');
    console.log(`Clave nueva creada en ${KEY_FILE}`);
  }
  return readFileSync(KEY_FILE, 'utf8').trim();
}

async function encrypt(): Promise<void> {
  const payload = parseSchedulePayload(JSON.parse(readFileSync(PLAIN, 'utf8')));
  const password = readPassword();
  // Se reutiliza la sal si la clave no ha cambiado: así los móviles ya desbloqueados siguen funcionando.
  let salt = randomBytes(16);
  let iter = DEFAULT_ITERATIONS;
  if (existsSync(ENC)) {
    const old = JSON.parse(readFileSync(ENC, 'utf8')) as EncryptedPayload;
    try {
      await decryptWithPassword(old, password);
      salt = fromBase64(old.salt);
      iter = old.iter;
    } catch {
      console.log('La clave ha cambiado: habrá que volver a desbloquear el horario en el móvil.');
    }
  }
  const key = await deriveKey(password, salt, iter);
  const out = await encryptWithKey(payload, key, salt, iter);
  writeFileSync(ENC, JSON.stringify(out, null, 2) + '\n');
  console.log(`Horario cifrado en ${ENC}`);
}

async function decrypt(): Promise<void> {
  const payload = JSON.parse(readFileSync(ENC, 'utf8')) as EncryptedPayload;
  const { value } = await decryptWithPassword(payload, readPassword());
  writeFileSync(PLAIN, JSON.stringify(parseSchedulePayload(value), null, 2) + '\n');
  console.log(`Horario descifrado en ${PLAIN}`);
}

const cmd = process.argv[2];
if (cmd === 'encrypt') await encrypt();
else if (cmd === 'decrypt') await decrypt();
else {
  console.error('Uso: node scripts/schedule.ts encrypt|decrypt');
  process.exit(1);
}
