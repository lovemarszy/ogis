// app/api/og/themes/pixel.tsx
import React from 'react';
import fs from 'fs/promises';
import path from 'path';
import type { ThemeProps, ThemeFont, ThemeDefinition, ThemeContext } from './types';

async function loadFonts(context: ThemeContext): Promise<ThemeFont[]> {
  try {
    const fontPath = path.join(process.cwd(), 'public/fonts/zpix.ttf');
    const fontData = await fs.readFile(fontPath);
    return [{ 
      name: 'Zpix', 
      data: fontData.buffer, 
      style: 'normal', 
      weight: 400 
    }];
  } catch (e) {
    console.error('Failed to load local font:', e);
    return [];
  }
}

function render(props: ThemeProps, context: ThemeContext): React.ReactElement {
  const { title, site, excerpt, author, date, backgroundImageSrc, tag } = props;

  // 复原：原始标题字号计算逻辑
  const displayTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const displayExcerpt = excerpt && excerpt.length > 80 ? excerpt.slice(0, 77) + '...' : excerpt;
  const titleFontSize = displayTitle.length > 40 ? 56 : displayTitle.length > 25 ? 72 : 88;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        fontFamily: '"Zpix", sans-serif',
        background: '#0a0a0a',
      }}
    >
      <img
        src={backgroundImageSrc}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />

      {/* 复原：Tag 气泡的精确大小和对齐 */}
      {tag && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            right: '64px',
            display: 'flex',
            height: '48px', // 固定高度复原
            padding: '0 24px',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(12px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            fontSize: '22px', // 字号复原
            color: '#fff',
            zIndex: 10,
          }}
        >
          {/* 复原：为了像素字体垂直居中的 4px 偏移 */}
          <span style={{ display: 'flex', paddingTop: '4px' }}>
            {tag}
          </span>
        </div>
      )}

      {/* 复原：底部渐变遮罩和 16px 模糊 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '420px',
          display: 'flex',
          background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.15) 70%, transparent 100%)',
          backdropFilter: 'blur(16px)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '64px',
          bottom: '64px',
          right: '64px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2,
        }}
      >
        {/* 复原：站点名称间距 */}
        <span
          style={{
            fontSize: '24px',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.9)',
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.6)',
            marginBottom: '28px',
          }}
        >
          {site}
        </span>

        {/* 复原：标题动态边距逻辑 */}
        <h1
          style={{
            fontSize: `${titleFontSize}px`,
            fontWeight: 400,
            color: '#fff',
            lineHeight: 1.15,
            margin: 0,
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
            marginBottom: displayExcerpt ? '32px' : (author || date) ? '28px' : '0',
          }}
        >
          {displayTitle}
        </h1>

        {/* 复原：简介样式 */}
        {displayExcerpt && (
          <p
            style={{
              fontSize: '26px',
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.75)',
              lineHeight: 1.5,
              margin: 0,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
              marginBottom: (author || date) ? '28px' : '0',
            }}
          >
            {displayExcerpt}
          </p>
        )}

        {/* 复原：作者和日期样式 */}
        {(author || date) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '20px',
              color: 'rgba(255, 255, 255, 0.55)',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
            }}
          >
            {author && <span>{author}</span>}
            {author && date && <span style={{ opacity: 0.6 }}>·</span>}
            {date && <span>{date}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export const pixelTheme: ThemeDefinition = {
  loadFonts,
  render,
  fontFamily: '"Zpix", sans-serif',
};