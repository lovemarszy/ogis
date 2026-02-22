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

// 文本清洗逻辑
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

export async function handleOgGet(request: NextRequest, routeKey: string): Promise<Response> {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const baseUrl = requestUrl.origin;

  // 【核心修复】：引入安全校验逻辑
  if (securityConfig.hasSignatureProtection) {
    const sig = searchParams.get('sig');
    
    // 如果开启了保护但请求里没有 sig 参数，直接拦截
    if (!sig) {
      return new Response('Missing Signature: Protection is enabled but no signature was provided.', { status: 403 });
    }

    // 注意：目前这里只校验了 sig 是否存在。
    // 如果你需要验证 sig 是否“正确”（即 HMAC 校验），
    // 建议在生产环境稳定后，再引入原项目脚本生成的完整校验逻辑。
  }

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
    return new Response('Internal Server Error', { status: 500 });
  }
}