import { isIP } from 'node:net';
const BLOCKED_HOSTNAMES = new Set(['localhost']);
function isPrivateOrLoopbackIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}
function isPrivateOrLoopbackIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  const firstGroup = parseInt(normalized.split(':')[0] || '0', 16);
  if (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) return true;
  if (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) return true;
  return false;
}
export function assertSafeNavigationUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Refusing to navigate to an invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Refusing to navigate to a non-http(s) URL: ${url}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new Error(`Refusing to navigate to a loopback host: ${url}`);
  }
  const bareHostname = hostname.startsWith('[')
    ? hostname.slice(1, -1)
    : hostname;
  const ipVersion = isIP(bareHostname);
  if (ipVersion === 4 && isPrivateOrLoopbackIPv4(bareHostname)) {
    throw new Error(`Refusing to navigate to a private/loopback IP: ${url}`);
  }
  if (ipVersion === 6 && isPrivateOrLoopbackIPv6(bareHostname)) {
    throw new Error(`Refusing to navigate to a private/loopback IP: ${url}`);
  }
}
