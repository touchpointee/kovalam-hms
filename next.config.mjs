/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/pharmacy/medicines", destination: "/pharmacy/stock", permanent: true },
      { source: "/admin/pharmacy/medicines", destination: "/admin/pharmacy/stock", permanent: true },
    ];
  },
};

export default nextConfig;
