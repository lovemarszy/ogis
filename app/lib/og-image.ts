import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type DnsLookup = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>;

interface RemoteImageOptions {
  dnsLookup?: DnsLookup;
  fetchImpl?: typeof fetch;
}

function isBlockedIpv4(address: string): boolean {
  const [a, b, c] = address.split('.').map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIp(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  const family = isIP(normalized);

  if (family === 4) return isBlockedIpv4(normalized);
  if (family !== 6) return true;

  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice('::ffff:'.length);
    return isIP(mappedIpv4) !== 4 || isBlockedIpv4(mappedIpv4);
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  );
}

const defaultLookup: DnsLookup = async hostname =>
  lookup(hostname, { all: true, verbatim: true });

export async function assertSafeRemoteImageUrl(
  input: string,
  dnsLookup: DnsLookup = defaultLookup
): Promise<URL> {
  if (!input || input.length > 2_048) {
    throw new Error('Image URL is empty or too long.');
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Image URL is invalid.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS image URLs are allowed.');
  }
  if (url.username || url.password) {
    throw new Error('Image URLs must not contain credentials.');
  }
  if (url.port && url.port !== '443') {
    throw new Error('Custom image URL ports are not allowed.');
  }

  const rawHostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const hostname = rawHostname.startsWith('[') && rawHostname.endsWith(']')
    ? rawHostname.slice(1, -1)
    : rawHostname;
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('Local image hosts are not allowed.');
  }

  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (isBlockedIp(hostname)) throw new Error('Private image IPs are not allowed.');
    return url;
  }

  const addresses = await dnsLookup(hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
    throw new Error('Image host does not resolve to public IP addresses only.');
  }

  return url;
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  if (!response.body) throw new Error('Image response has no body.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('Image is larger than 8 MiB.');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchRemoteImageSource(
  input: string,
  options: RemoteImageOptions = {}
): Promise<string | ArrayBuffer> {
  let currentUrl = input;
  const dnsLookup = options.dnsLookup ?? defaultLookup;
  const fetchImpl = options.fetchImpl ?? fetch;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const url = await assertSafeRemoteImageUrl(currentUrl, dnsLookup);
    const response = await fetchImpl(url, {
      cache: 'force-cache',
      headers: {
        Accept: 'image/png,image/jpeg,image/gif,image/webp',
        'User-Agent': 'OGIS/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new Error('Image redirect is missing or exceeds the redirect limit.');
      }
      currentUrl = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Image server returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!contentType || !SUPPORTED_IMAGE_TYPES.has(contentType)) {
      throw new Error('Image response has an unsupported Content-Type.');
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new Error('Image is larger than 8 MiB.');
    }

    const body = await readLimitedBody(response);
    if (contentType === 'image/webp') return body.buffer as ArrayBuffer;
    return `data:${contentType};base64,${Buffer.from(body).toString('base64')}`;
  }

  throw new Error('Image redirect limit exceeded.');
}
