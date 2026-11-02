import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/my-documents", "/settings/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/my-documents", "/settings/"],
      },
    ],
    sitemap: "https://bricdoc-raghuraj.vercel.app/sitemap.xml",
  };
}
