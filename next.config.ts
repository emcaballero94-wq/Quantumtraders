import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Allow TradingView scripts and frames
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://widget.tradingview.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src 'self' https://www.tradingview.com https://s.tradingview.com",
              "connect-src 'self' https://api.twelvedata.com wss://ws.twelvedata.com https://api.anthropic.com https://*.supabase.co wss://*.supabase.co https://www.tradingview.com https://quotes.tradingview.com https://symbol-search.tradingview.com https://quotefast.tradingview.com",
              "img-src 'self' data: blob: https:",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
