import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Attegi-style theme configurations
const themes: Record<string, {
  // Background colors
  bgMain: string;
  bgSecondary: string;
  bgContrast: string;
  // Text colors
  textLead: string;
  textMain: string;
  textSecondary: string;
  // Card styling
  cardBg: string;
  cardBorder: string;
  // Tag chip
  tagBg: string;
  tagText: string;
  // Accent (for highlights)
  accent: string;
}> = {
  dark: {
    bgMain: '#1D1F21',
    bgSecondary: '#25282D',
    bgContrast: '#353A40',
    textLead: '#F6F7FA',
    textMain: '#E2E6EB',
    textSecondary: '#B6BBC4',
    cardBg: 'rgba(37, 40, 45, 0.95)',
    cardBorder: 'rgba(53, 58, 64, 0.8)',
    tagBg: 'rgba(255, 255, 255, 0.08)',
    tagText: '#B6BBC4',
    accent: '#6366f1',
  },
  light: {
    bgMain: '#FFFFFF',
    bgSecondary: '#F7F8FA',
    bgContrast: '#E1E3E6',
    textLead: '#000000',
    textMain: '#374151',
    textSecondary: '#73777D',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    cardBorder: 'rgba(225, 227, 230, 0.8)',
    tagBg: 'rgba(0, 0, 0, 0.05)',
    tagText: '#73777D',
    accent: '#6366f1',
  },
};

// Load Noto Sans SC with full Unicode support (Regular weight)
async function loadNotoSansRegular(): Promise<ArrayBuffer | null> {
  try {
    const fontUrl = 'https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.woff2';
    const response = await fetch(fontUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

// Load Noto Sans SC Bold
async function loadNotoSansBold(): Promise<ArrayBuffer | null> {
  try {
    const fontUrl = 'https://fonts.gstatic.com/s/notosanssc/v37/k3kXo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.woff2';
    const response = await fetch(fontUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

// Sanitize text - replace unsupported characters with safe alternatives
function sanitizeText(text: string): string {
  return text
    .replace(/[⸺⸻—–-]+/g, ' — ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    .replace(/[\u2000-\u200F\u2028-\u202F]/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Required parameters
  const rawTitle = searchParams.get('title') || 'Untitled';
  const rawSite = searchParams.get('site') || 'Blog';

  // Optional parameters
  const rawExcerpt = searchParams.get('excerpt') || '';
  const author = searchParams.get('author') || '';
  const tag = searchParams.get('tag') || '';
  const date = searchParams.get('date') || '';
  const reading = searchParams.get('reading') || '';
  const theme = searchParams.get('theme') || 'dark';
  let image = searchParams.get('image') || '';
  const icon = searchParams.get('icon') || '';
  const avatar = searchParams.get('avatar') || '';

  // Fix truncated Unsplash URLs
  if (image.includes('images.unsplash.com')) {
    const unsplashParams: string[] = [];
    const knownUnsplashParams = ['crop', 'cs', 'fit', 'fm', 'ixid', 'ixlib', 'q', 'w', 'h'];
    for (const param of knownUnsplashParams) {
      const value = searchParams.get(param);
      if (value) {
        unsplashParams.push(`${param}=${value}`);
      }
    }
    if (unsplashParams.length > 0) {
      image = image + '&' + unsplashParams.join('&');
    }
  }

  // Validate image URLs
  const isValidUrl = (url: string) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      if (url.endsWith('…') || url.endsWith('...') || url.length < 20) return false;
      return true;
    } catch {
      return false;
    }
  };

  // Check if image format is supported by @vercel/og
  const isSupportedImageFormat = (url: string) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('/format/jpeg/') || lowerUrl.includes('/format/png/') || lowerUrl.includes('/format/jpg/')) {
      return true;
    }
    if (lowerUrl.match(/\.(webp|avif)(\?|$)/i)) return false;
    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    const hasExtension = supportedExtensions.some(ext => lowerUrl.includes(ext));
    return hasExtension || !lowerUrl.match(/\.(webp|avif|svg|bmp|tiff?)(\?|$)/i);
  };

  const validIcon = isValidUrl(icon) && isSupportedImageFormat(icon) ? icon : '';
  const validAvatar = isValidUrl(avatar) && isSupportedImageFormat(avatar) ? avatar : '';
  const validImage = isValidUrl(image) && isSupportedImageFormat(image) ? image : '';

  // Helper function to fetch image and convert to base64
  async function fetchImageAsBase64(url: string): Promise<string> {
    if (!url) return '';
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGImageBot/1.0)' },
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
      }
    } catch (e) {
      console.error('Failed to fetch image:', url, e);
    }
    return '';
  }

  // Pre-fetch all images in parallel
  const [backgroundImageSrc, iconSrc, avatarSrc] = await Promise.all([
    fetchImageAsBase64(validImage),
    fetchImageAsBase64(validIcon),
    fetchImageAsBase64(validAvatar),
  ]);

  // Sanitize text inputs
  const title = sanitizeText(rawTitle);
  const site = sanitizeText(rawSite);
  const excerpt = sanitizeText(rawExcerpt);

  const selectedTheme = themes[theme] || themes.dark;

  // Truncate text for display
  const displayTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const displayExcerpt = excerpt.length > 100 ? excerpt.slice(0, 97) + '...' : excerpt;

  // Load fonts
  const [fontRegular, fontBold] = await Promise.all([
    loadNotoSansRegular(),
    loadNotoSansBold(),
  ]);

  // Calculate font size based on title length
  const titleFontSize = displayTitle.length > 40 ? 52 : displayTitle.length > 25 ? 60 : 72;

  // Build fonts array
  const fonts: { name: string; data: ArrayBuffer; style: 'normal'; weight: 400 | 700 }[] = [];
  if (fontRegular) {
    fonts.push({ name: 'Noto Sans SC', data: fontRegular, style: 'normal', weight: 400 });
  }
  if (fontBold) {
    fonts.push({ name: 'Noto Sans SC', data: fontBold, style: 'normal', weight: 700 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: '"Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: selectedTheme.bgMain,
        }}
      >
        {/* Background image (if provided) - subtle, blurred */}
        {backgroundImageSrc && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            <img
              src={backgroundImageSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                opacity: 0.15,
                filter: 'blur(40px)',
              }}
            />
          </div>
        )}

        {/* Main content area with padding */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '60px',
          }}
        >
          {/* Card container - Attegi style */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              width: '100%',
              height: '100%',
              background: selectedTheme.cardBg,
              borderRadius: '24px',
              border: `1px solid ${selectedTheme.cardBorder}`,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Left side - Feature image */}
            {backgroundImageSrc && (
              <div
                style={{
                  display: 'flex',
                  width: '45%',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={backgroundImageSrc}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                />
                {/* Gradient overlay on image */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    background: theme === 'light'
                      ? 'linear-gradient(to right, rgba(255,255,255,0) 60%, rgba(255,255,255,1) 100%)'
                      : 'linear-gradient(to right, rgba(29,31,33,0) 60%, rgba(29,31,33,1) 100%)',
                  }}
                />
              </div>
            )}

            {/* Right side - Content */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                flex: 1,
                padding: backgroundImageSrc ? '48px 56px 48px 32px' : '48px 56px',
                minWidth: 0,
              }}
            >
              {/* Top: Site branding + Tags */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                {/* Site branding */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {iconSrc ? (
                    <img
                      src={iconSrc}
                      width={40}
                      height={40}
                      style={{
                        borderRadius: '10px',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: selectedTheme.tagBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: selectedTheme.textMain,
                      }}
                    >
                      {site.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    style={{
                      fontSize: '20px',
                      fontWeight: 500,
                      color: selectedTheme.textSecondary,
                    }}
                  >
                    {site}
                  </span>
                </div>

                {/* Tag chip */}
                {tag && (
                  <div
                    style={{
                      display: 'flex',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      background: selectedTheme.tagBg,
                      color: selectedTheme.tagText,
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </div>
                )}
              </div>

              {/* Middle: Title and excerpt */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  flex: 1,
                  justifyContent: 'center',
                  paddingTop: '24px',
                  paddingBottom: '24px',
                }}
              >
                <h1
                  style={{
                    fontSize: `${titleFontSize}px`,
                    fontWeight: 700,
                    color: selectedTheme.textLead,
                    lineHeight: 1.2,
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {displayTitle}
                </h1>

                {displayExcerpt && (
                  <p
                    style={{
                      fontSize: '20px',
                      color: selectedTheme.textSecondary,
                      lineHeight: 1.6,
                      margin: 0,
                      fontWeight: 400,
                    }}
                  >
                    {displayExcerpt}
                  </p>
                )}
              </div>

              {/* Bottom: Meta info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: `1px solid ${selectedTheme.cardBorder}`,
                  paddingTop: '20px',
                }}
              >
                {/* Author */}
                {author ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        width={36}
                        height={36}
                        style={{
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: selectedTheme.tagBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: selectedTheme.textMain,
                        }}
                      >
                        {author.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        color: selectedTheme.textMain,
                      }}
                    >
                      {author}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex' }} />
                )}

                {/* Date and reading time */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                  }}
                >
                  {date && (
                    <span
                      style={{
                        fontSize: '14px',
                        color: selectedTheme.textSecondary,
                        fontWeight: 400,
                      }}
                    >
                      {date}
                    </span>
                  )}
                  {reading && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        color: selectedTheme.textSecondary,
                        fontWeight: 400,
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={selectedTheme.textSecondary}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{reading}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1600,
      height: 840,
      fonts: fonts.length > 0 ? fonts : undefined,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}
