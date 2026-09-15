// app/api/og/handler.tsx

import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { fetchRemoteImageSource } from '@/app/lib/og-image';
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

function readTextParam(
  searchParams: URLSearchParams,
  key: string,
  maxLength: number
): string {
  return sanitizeText(searchParams.get(key)).slice(0, maxLength);
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

  const title = readTextParam(searchParams, 'title', 60);
  const site = readTextParam(searchParams, 'site', 80);
  if (!title || !site) {
    return new Response('Missing required title or site parameter', { status: 400 });
  }

  let backgroundImageSrc: ThemeProps['backgroundImageSrc'] = `${baseUrl}/default-bg.jpg`;
  const requestedImage = searchParams.get('image');
  if (requestedImage) {
    try {
      backgroundImageSrc = await fetchRemoteImageSource(requestedImage);
    } catch (error) {
      console.warn('Rejected remote OG background image:', error);
      return new Response('Invalid or unavailable image URL', { status: 400 });
    }
  }

  const props: ThemeProps = {
    title,
    site,
    excerpt: readTextParam(searchParams, 'excerpt', 80),
    author: readTextParam(searchParams, 'author', 60),
    date: readTextParam(searchParams, 'date', 32),
    tag: readTextParam(searchParams, 'tag', 40),
    backgroundImageSrc,
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
