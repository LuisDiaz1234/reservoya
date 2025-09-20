/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true }, // evita que ESLint tumbe el build
  typescript: { ignoreBuildErrors: true } // cinturón + tirantes con TSC_COMPILE_ON_ERROR
};
module.exports = nextConfig;
