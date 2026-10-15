import type { NextConfig } from "next";

// لو الريبو اسمه غير username.github.io، الـ workflow بيحط NEXT_PUBLIC_BASE_PATH لوحده
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
