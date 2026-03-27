import type { MetadataRoute } from "next";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";

export default function manifest(): MetadataRoute.Manifest {
  const logo = "/hospital-logo.png";
  return {
    id: "/",
    name: `${hospitalName} — HMS`,
    short_name: hospitalName,
    description: `${hospitalName} Hospital Management System`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8fafc",
    theme_color: "#1e3a8a",
    categories: ["medical", "health", "productivity"],
    icons: [
      {
        src: logo,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: logo,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: logo,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
