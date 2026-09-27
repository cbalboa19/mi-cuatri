// Cifra / descifra el perfil (horario + configuración propia). Se ejecuta con Node (>= 22.18):
//   npm run profile:encrypt   local/profile.json → src/config/profile.enc.json
//   npm run profile:decrypt   src/config/profile.enc.json → local/profile.json
// La clave se lee de local/schedule.key (se crea la primera vez).

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  DEFAULT_ITERATIONS,
  decryptWithPassword,
  deriveKey,
  encryptWithKey,
  fromBase64,
  randomBytes,
  type EncryptedPayload,
} from '../src/domain/crypto.ts';
import { parseProfilePayload } from '../src/domain/profile.ts';

const PLAIN = 'local/profile.json';
const KEY_FILE = 'local/schedule.key';
const ENC = 'src/config/profile.enc.json';
/** Formato anterior (solo horario): se usa para conservar la sal y luego se borra. */
const LEGACY_ENC = 'src/config/schedule.enc.json';

/** Clave legible tipo "k7mq-2xpa-9dhe" (12 caracteres de 31 posibles, ~59 bits). */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const chars = [...randomBytes(12)].map((b) => alphabet[b % alphabet.length]);
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
  const payload = parseProfilePayload(JSON.parse(readFileSync(PLAIN, 'utf8')));
  const password = readPassword();
  // Se reutiliza la sal si la clave no ha cambiado: así los móviles ya desbloqueados siguen funcionando.
  let salt = randomBytes(16);
  let iter = DEFAULT_ITERATIONS;
  const previous = existsSync(ENC) ? ENC : existsSync(LEGACY_ENC) ? LEGACY_ENC : null;
  if (previous) {
    const old = JSON.parse(readFileSync(previous, 'utf8')) as EncryptedPayload;
    try {
      await decryptWithPassword(old, password);
      salt = fromBase64(old.salt);
      iter = old.iter;
    } catch {
      console.log('La clave ha cambiado: habrá que volver a escribirla en el móvil.');
    }
  }
  const key = await deriveKey(password, salt, iter);
  writeFileSync(ENC, JSON.stringify(await encryptWithKey(payload, key, salt, iter), null, 2) + '\n');
  if (existsSync(LEGACY_ENC)) rmSync(LEGACY_ENC);
  console.log(`Perfil cifrado en ${ENC}`);
}

async function decrypt(): Promise<void> {
  const payload = JSON.parse(readFileSync(ENC, 'utf8')) as EncryptedPayload;
  const { value } = await decryptWithPassword(payload, readPassword());
  writeFileSync(PLAIN, JSON.stringify(parseProfilePayload(value), null, 2) + '\n');
  console.log(`Perfil descifrado en ${PLAIN}`);
}

const cmd = process.argv[2];
if (cmd === 'encrypt') await encrypt();
else if (cmd === 'decrypt') await decrypt();
else {
  console.error('Uso: node scripts/profile.ts encrypt|decrypt');
  process.exit(1);
}
