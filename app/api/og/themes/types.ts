// app/api/og/themes/types.ts
import { ReactElement } from 'react';

export interface ThemeProps {
  title: string;
  site: string;
  excerpt?: string;
  author?: string;
  date?: string;
  backgroundImageSrc: string;
  tag?: string;
}

export interface ThemeFont {
  name: string;
  data: ArrayBuffer;
  style: 'normal' | 'italic';
  // 修正：将 number 改为具体的字面量联合类型，以匹配 @vercel/og 的要求
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
}

export interface ThemeContext {
  searchParams: URLSearchParams;
  baseUrl: string;
}

export interface ThemeDefinition {
  loadFonts: (context: ThemeContext) => Promise<ThemeFont[]>;
  render: (props: ThemeProps, context: ThemeContext) => ReactElement;
  fontFamily: string;
}