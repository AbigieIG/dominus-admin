import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import settings from "~/assets/settings.json";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const naviagetion = useNavigation();
  const isLoading = naviagetion.state === "loading";
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <link rel="icon" type="image/png" href={settings.site.logo} />

        {/* Primary Meta Tags */}
        <meta name="title" content={settings.site.title} />
        <meta name="description" content={settings.site.description} />
        <meta name="keywords" content={settings.site.keywords} />
        <meta name="author" content={settings.site.author} />
        {/* <meta name="robots" content="index, follow" /> */}

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={settings.site.title} />
        <meta property="og:description" content={settings.site.description} />
        <meta property="og:image" content={settings.site.og_image} />
        <meta property="og:url" content={settings.site.url} />
        <meta property="og:site_name" content={settings.site.name} />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={settings.site.title} />
        <meta name="twitter:description" content={settings.site.description} />
        <meta name="twitter:image" content={settings.site.og_image} />

        {/* Additional SEO Meta Tags */}
        <meta name="theme-color" content="#ffffff" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="format-detection" content="telephone=no" />

        {/* Google Site Verification */}
        <meta
          name="google-site-verification"
          content="nQzQLZhPXvGVKUx_DWkfHmPJy8KEQjSoGqjLhTUBlkw"
        />

        {/* Bing Site Verification */}
        <meta name="msvalidate.01" content="" />

        {/* Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <Meta />
        <Links />
      </head>
      <body>
        {isLoading && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center backdrop-blur-sm ">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600"></div>
              {/* <span className="mt-4 text-green-700 font-semibold">Loading...</span> */}
            </div>
          </div>
        )}
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
