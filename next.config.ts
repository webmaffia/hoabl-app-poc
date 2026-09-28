import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Stand-in thumbnails for the illustrative demo projects (mopa, nagpur),
    // reused from HoABL's public project photography.
    remotePatterns: [{ protocol: "https", hostname: "hoabl-bucket.s3.ap-south-1.amazonaws.com" }],
  },
};

export default nextConfig;
