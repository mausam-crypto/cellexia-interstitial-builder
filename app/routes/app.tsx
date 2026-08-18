import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { requireAdmin } from "../lib/auth.server";

// Static copies (public/vendor/polaris.css is copied from @shopify/polaris; keep in sync when upgrading Polaris).
export const links = () => [
  { rel: "stylesheet", href: "/vendor/polaris.css" },
  { rel: "stylesheet", href: "/builder/admin.css" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { devMode } = await requireAdmin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "", devMode };
};

export default function App() {
  const { apiKey, devMode } = useLoaderData<typeof loader>();
  if (devMode) {
    // Local UI development without a Shopify session (BUILDER_DEV_SHOP): Polaris only, plain nav.
    return (
      <PolarisProvider i18n={enTranslations}>
        <nav style={{ display: "flex", gap: 16, padding: "10px 20px", background: "#1d1d1b", color: "#fff", fontSize: 13 }}>
          <Link to="/app" style={{ color: "#fff" }}>Pages</Link>
          <Link to="/app/pages/new" style={{ color: "#fff" }}>New page</Link>
          <Link to="/app/analytics" style={{ color: "#fff" }}>Analytics</Link>
          <Link to="/app/settings" style={{ color: "#fff" }}>Settings</Link>
          <Link to="/app/prompts" style={{ color: "#fff" }}>Prompts</Link>
          <Link to="/app/help" style={{ color: "#fff" }}>Guide</Link>
          <span style={{ marginLeft: "auto", opacity: 0.6 }}>dev mode</span>
        </nav>
        <Outlet />
      </PolarisProvider>
    );
  }
  return (
    <AppProvider apiKey={apiKey}>
      <PolarisProvider i18n={enTranslations}>
        <NavMenu>
          <Link to="/app" rel="home">Pages</Link>
          <Link to="/app/pages/new">New page</Link>
          <Link to="/app/analytics">Analytics</Link>
          <Link to="/app/settings">Settings</Link>
          <Link to="/app/prompts">Prompts</Link>
          <Link to="/app/help">Guide</Link>
        </NavMenu>
        <Outlet />
      </PolarisProvider>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
