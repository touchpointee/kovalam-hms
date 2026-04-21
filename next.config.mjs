/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable build trace file generation — not needed for npm start deployments
  // and prevents OneDrive from locking .nft.json files during the build
  outputFileTracing: false,
  eslint: {
    // Run lint explicitly from the build script so Next doesn't need its own build-time worker path.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Run `tsc --noEmit` explicitly from the build script so Next skips its worker-based type check.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Some Windows/sandboxed environments block Next's build worker process spawn.
    // Use worker threads and keep webpack builds in-process so `next build` works reliably there.
    workerThreads: true,
    webpackBuildWorker: false,
  },

  async redirects() {
    return [
      { source: "/pharmacy/medicines", destination: "/pharmacy/store-stock", permanent: true },
      { source: "/admin/pharmacy/medicines", destination: "/admin/pharmacy/store-stock", permanent: true },
    ];
  },
};

export default nextConfig;
