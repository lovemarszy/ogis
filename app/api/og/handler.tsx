// app/api/og/handler.tsx

import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { resolveOgSecurityConfig } from '@/app/lib/og-security';
import { pixelTheme } from './themes/pixel';
import type { ThemeProps } from './themes/types';

const themes = {
  pixel: pixelTheme,
};

const securityConfig = resolveOgSecurityConfig();
const signatureSecret = securityConfig.signatureSecret;
const hasSignatureProtection = securityConfig.hasSignatureProtection;

// --- 安全校验核心工具函数 (同步原项目算法) ---

function sanitizeText(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/[⸺⸻—–-]+/g, ' — ')
    .replace(/[""“”]/g, '"')
    .replace(/[''‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[\u2000-\u200F\u2028-\u202F]/g, ' ')
    .trim();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function canonicalizeSearchParams(searchParams: URLSearchParams): string {
  const entries: Array<[string, string]> = [];
  searchParams.forEach((value, key) => {
    if (key === 'sig') return; // 排除签名本身
    entries.push([key, value]);
  });
  entries.sort((a, b) => (a[0] < b[0] ? -1 : 1)); // 参数排序确保哈希一致
  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function signPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signatureSecret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  return Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hasValidSignature(requestUrl: URL): Promise<boolean> {
  if (!hasSignatureProtection) return true;

  const providedSig = (requestUrl.searchParams.get('sig') ?? '').trim();
  if (!providedSig) return false;

  const canonicalQuery = canonicalizeSearchParams(requestUrl.searchParams);
  const payload = canonicalQuery || '__empty__';
  const expectedSig = await signPayload(payload);

  return constantTimeEqual(expectedSig, providedSig);
}

// --- 主处理函数 ---

export async function handleOgGet(request: NextRequest, routeKey: string): Promise<Response> {
  const requestUrl = new URL(request.url);
  
  // 【真正的安全锁】：校验签名是否匹配私钥
  if (!(await hasValidSignature(requestUrl))) {
    return new Response('Invalid or Missing Signature', { status: 403 });
  }

  const { searchParams } = requestUrl;
  const baseUrl = requestUrl.origin;
  const themeContext = { searchParams, baseUrl };
  const theme = themes.pixel;

  const props: ThemeProps = {
    title: sanitizeText(searchParams.get('title')),
    site: sanitizeText(searchParams.get('site')),
    excerpt: sanitizeText(searchParams.get('excerpt')),
    author: searchParams.get('author') || '',
    date: searchParams.get('date') || '',
    tag: searchParams.get('tag') || '',
    backgroundImageSrc: searchParams.get('image') || `${baseUrl}/default-bg.jpg`,
  };

  try {
    const fonts = await theme.loadFonts(themeContext);
    return new ImageResponse(
      theme.render(props, themeContext),
      {
        width: 1200,
        height: 630,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    console.error('OG Image generation failed:', error);
    return new Response('Internal Error', { status: 500 });
  }
}