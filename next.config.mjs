/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/pharmacy/medicines", destination: "/pharmacy/store-stock", permanent: true },
      { source: "/admin/pharmacy/medicines", destination: "/admin/pharmacy/store-stock", permanent: true },
    ];
  },
};

export default nextConfig;
