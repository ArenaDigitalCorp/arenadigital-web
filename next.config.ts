import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-b3be5503931e45b18032c9fe87b9d309.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
