/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow product images served from your Supabase Storage project.
    // Replace YOUR_PROJECT_REF with your actual Supabase project ref, or
    // keep remotePatterns broad during development.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
