/** @type {import('next').NextConfig} */
// 普通 `npm run build` 不生成 standalone：Windows 上拷贝整包 node_modules 很慢，
// 只有桌面端打包（desktop:build / desktop:dist / desktop:portable）才需要。
const standalone = process.env.NEXT_OUTPUT === 'standalone';

const nextConfig = {
  // 开发/测试时可以换一个独立目录，避免 safe-delete 拦截 Next 清理 .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: false,
  // 桌面端用 standalone 产物在 Electron 主进程里直接起服务
  ...(standalone ? { output: 'standalone' } : {}),
  webpack: (config) => {
    // pdfjs / mammoth 在浏览器端运行，避免 node 原生依赖被打进来
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
