import { NextRequest } from 'next/server';
import { handleOgGet } from './handler';

// 必须保留 nodejs 运行时以支持 fs 模块读取本地字体
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 这里的 'og' 对应你在 Vercel 设置的 OG_PRIMARY_ROUTE_KEY
  return handleOgGet(request, 'og');
}