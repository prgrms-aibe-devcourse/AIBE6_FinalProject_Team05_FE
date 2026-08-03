/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // 현재 시드 데이터 기준, 실제 Scrydex 연동 시 재확인 필요
      { protocol: "https", hostname: "images.scrydex.com" },
    ],
  },
};

export default nextConfig;
