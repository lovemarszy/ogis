import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSafeRemoteImageUrl,
  fetchRemoteImageAsDataUrl,
  type DnsLookup,
} from './og-image';

const publicDns: DnsLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const privateDns: DnsLookup = async () => [{ address: '10.0.0.1', family: 4 }];

test('accepts an HTTPS image host that resolves only to public IPs', async () => {
  const url = await assertSafeRemoteImageUrl('https://example.com/background.jpg', publicDns);
  assert.equal(url.hostname, 'example.com');
});

test('rejects HTTP, credentials, and custom ports', async () => {
  await assert.rejects(() => assertSafeRemoteImageUrl('http://example.com/a.jpg', publicDns));
  await assert.rejects(() => assertSafeRemoteImageUrl('https://user:pass@example.com/a.jpg', publicDns));
  await assert.rejects(() => assertSafeRemoteImageUrl('https://example.com:8443/a.jpg', publicDns));
});

test('rejects private IP literals and private DNS answers', async () => {
  await assert.rejects(() => assertSafeRemoteImageUrl('https://127.0.0.1/a.jpg', publicDns));
  await assert.rejects(() => assertSafeRemoteImageUrl('https://[::1]/a.jpg', publicDns));
  await assert.rejects(() => assertSafeRemoteImageUrl('https://example.com/a.jpg', privateDns));
});

test('rejects local hostnames', async () => {
  await assert.rejects(() => assertSafeRemoteImageUrl('https://localhost/a.jpg', publicDns));
  await assert.rejects(() => assertSafeRemoteImageUrl('https://service.internal/a.jpg', publicDns));
});

test('converts a supported image response to a data URL', async () => {
  const fetchImpl = (async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/png' },
    })) as typeof fetch;

  const result = await fetchRemoteImageAsDataUrl('https://example.com/a.png', {
    dnsLookup: publicDns,
    fetchImpl,
  });
  assert.equal(result, 'data:image/png;base64,AQID');
});

test('converts a WebP image response to a data URL', async () => {
  const fetchImpl = (async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/webp' },
    })) as typeof fetch;

  const result = await fetchRemoteImageAsDataUrl('https://example.com/a.webp', {
    dnsLookup: publicDns,
    fetchImpl,
  });
  assert.equal(result, 'data:image/webp;base64,AQID');
});

test('rejects redirects to private networks', async () => {
  const fetchImpl = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: 'https://127.0.0.1/private.png' },
    })) as typeof fetch;

  await assert.rejects(() =>
    fetchRemoteImageAsDataUrl('https://example.com/a.png', {
      dnsLookup: publicDns,
      fetchImpl,
    })
  );
});

test('rejects unsupported and oversized image responses', async () => {
  const unsupportedFetch = (async () =>
    new Response('not an image', {
      headers: { 'content-type': 'text/plain' },
    })) as typeof fetch;
  await assert.rejects(() =>
    fetchRemoteImageAsDataUrl('https://example.com/a.png', {
      dnsLookup: publicDns,
      fetchImpl: unsupportedFetch,
    })
  );

  const oversizedFetch = (async () =>
    new Response(new Uint8Array([1]), {
      headers: {
        'content-length': String(8 * 1024 * 1024 + 1),
        'content-type': 'image/png',
      },
    })) as typeof fetch;
  await assert.rejects(() =>
    fetchRemoteImageAsDataUrl('https://example.com/a.png', {
      dnsLookup: publicDns,
      fetchImpl: oversizedFetch,
    })
  );
});
