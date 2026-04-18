/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable build trace file generation — not needed for npm start deployments
  // and prevents OneDrive from locking .nft.json files during the build
  outputFileTracing: false,

  async redirects() {
    return [
      { source: "/pharmacy/medicines", destination: "/pharmacy/store-stock", permanent: true },
      { source: "/admin/pharmacy/medicines", destination: "/admin/pharmacy/store-stock", permanent: true },
    ];
  },
};

export default nextConfig;
