// app/api/og/handler.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { pixelTheme } from './themes/pixel';
import type { ThemeProps } from './themes/types';

export async function handleOgGet(request: NextRequest, routeKey: string): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const baseUrl = origin;
  const themeContext = { searchParams, baseUrl };

  // 这里的属性必须和 ThemeProps 一一对应
  const props: ThemeProps = {
    title: searchParams.get('title') || 'Untitled',
    site: searchParams.get('site') || 'Blog',
    excerpt: searchParams.get('excerpt') || '',
    author: searchParams.get('author') || '',
    date: searchParams.get('date') || '',
    tag: searchParams.get('tag') || '',
    backgroundImageSrc: searchParams.get('image') || `${baseUrl}/default-bg.jpg`,
  };

  try {
    const fonts = await pixelTheme.loadFonts(themeContext);
    return new ImageResponse(
      pixelTheme.render(props, themeContext),
      {
        width: 1200,
        height: 630,
        fonts: fonts.length > 0 ? fonts : undefined,
      }
    );
  } catch (e) {
    return new Response('Failed to generate image', { status: 500 });
  }
}