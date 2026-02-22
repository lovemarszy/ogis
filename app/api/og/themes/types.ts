// app/api/og/themes/types.ts
import { ReactElement } from 'react';

export interface ThemeProps {
  title: string;
  site: string;
  excerpt?: string;
  author?: string;
  date?: string;
  backgroundImageSrc: string;
  tag?: string; // 必须有这一行
}

export interface ThemeFont {
  name: string;
  data: ArrayBuffer;
  style: 'normal' | 'italic';
  weight: number;
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