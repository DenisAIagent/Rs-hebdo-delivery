import net from 'node:net';

/** Octets d'une IPv4 « a.b.c.d », ou null. */
function parseV4(ip: string): number[] | null {
  if (!net.isIPv4(ip)) return null;
  return ip.split('.').map(Number);
}

function isPrivateV4(p: number[]): boolean {
  const [a, b] = p;
  return (
    a === 0 || // « ce réseau »
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT (réseaux privés de certains hébergeurs)
    (a === 169 && b === 254) || // lien-local, métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) ||
    (a === 198 && (b === 18 || b === 19)) || // bancs de test
    a >= 224 // multicast et réservé
  );
}

/** IPv4 embarquée dans une IPv6 (« ::ffff:a.b.c.d » ou « ::ffff:hhhh:hhhh »), ou null. */
function embeddedV4(v6: string): number[] | null {
  const mapped = v6.match(/^(?:::ffff:|64:ff9b::)(.+)$/);
  if (!mapped) return null;
  const tail = mapped[1];
  const dotted = parseV4(tail);
  if (dotted) return dotted;
  const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

/**
 * Adresse IP privée, loopback, lien-local ou réservée : cible d'une attaque
 * SSRF vers les services internes. Tout ce qui n'est pas reconnu comme une IP
 * valide est considéré comme privé (refus par défaut).
 */
export function isPrivateIp(ip: string): boolean {
  const v4 = parseV4(ip);
  if (v4) return isPrivateV4(v4);
  if (!net.isIPv6(ip)) return true;

  const v6 = ip.toLowerCase().split('%')[0];
  if (v6 === '::' || v6 === '::1') return true;
  const inner = embeddedV4(v6);
  if (inner) return isPrivateV4(inner);
  return (
    v6.startsWith('fc') || v6.startsWith('fd') || // adresses locales uniques
    /^fe[89ab]/.test(v6) || // lien-local
    v6.startsWith('ff') // multicast
  );
}
