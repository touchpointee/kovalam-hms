import type { MetadataRoute } from "next";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";

export default function manifest(): MetadataRoute.Manifest {
  const logo = "/delma-logo.svg";
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
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: logo,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
