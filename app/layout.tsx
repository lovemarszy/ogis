import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'OGIS - Open Graph Image Service',
  description: 'A dynamic Open Graph image generation service built with Next.js 16 and deployed on the Vercel Node.js Runtime. Creates customized social media preview images with Zpix pixel font and frosted glass effects.',
  keywords: ['og image', 'open graph', 'social media', 'preview', 'image generation', 'node.js runtime', 'next.js', 'vercel', 'zpix'],
  authors: [{ name: 'bunizao', url: 'https://github.com/bunizao' }],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'OGIS - Open Graph Image Service',
    description: 'Dynamic OG image generation with pixel-style typography and frosted glass effects',
    type: 'website',
    url: 'https://og.tutuis.me',
    images: [
      {
        url: 'https://og.tutuis.me/api/og?title=OGIS&site=og.tutuis.me&excerpt=Dynamic%20Open%20Graph%20Image%20Service&author=bunizao&image=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1635776062127-d379bfcba9f8',
        width: 1200,
        height: 630,
        alt: 'OGIS - Open Graph Image Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OGIS - Open Graph Image Service',
    description: 'Dynamic OG image generation with pixel-style typography and frosted glass effects',
    images: ['https://og.tutuis.me/api/og?title=OGIS&site=og.tutuis.me&excerpt=Dynamic%20Open%20Graph%20Image%20Service&author=bunizao&image=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1635776062127-d379bfcba9f8'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
