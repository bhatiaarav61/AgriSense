/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for tiny Docker
  // images — used by the free 24/7 hosts (Fly.io, Render, Railway, Oracle Cloud).
  output: 'standalone',
  // TensorFlow.js is browser-only; keep it out of the server bundle.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, path: false };
    return config;
  },
};

export default nextConfig;
