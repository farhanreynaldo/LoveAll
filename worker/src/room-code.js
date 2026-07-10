// Charset excludes 0/O, 1/I/L to avoid visual ambiguity when read off a screen.
const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRoomCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += CHARSET[b % CHARSET.length];
  return code;
}
