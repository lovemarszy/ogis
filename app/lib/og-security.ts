// app/lib/og-security.ts

export function resolveOgSecurityConfig() {
  return {
    // 对应你在 Vercel 设置的 OG_SIGNATURE_SECRET
    signatureSecret: process.env.OG_SIGNATURE_SECRET || '',
    // 对应 NEXT_PUBLIC_OG_HAS_SIGNATURE_PROTECTION
    hasSignatureProtection: process.env.NEXT_PUBLIC_OG_HAS_SIGNATURE_PROTECTION === 'true',
    // 对应 OG_PRIMARY_ROUTE_KEY
    primaryRouteKey: process.env.OG_PRIMARY_ROUTE_KEY || 'og',
    // 对应 OG_ALLOW_LEGACY_PATH
    allowLegacyPath: process.env.OG_ALLOW_LEGACY_PATH === 'true',
  };
}