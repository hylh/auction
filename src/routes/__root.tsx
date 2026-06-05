import { QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ThemeToggle } from "../theme/ThemeToggle";
import { themeTokensCss } from "../theme/theme-tokens-css";
import { themeScript } from "../theme/theme-script";
import { getThemeFn } from "../theme/theme-server";
import "../styles.css";

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "Fish Auction House",
      },
      {
        name: "description",
        content: "Live fullstack TypeScript fish auction POC",
      },
    ],
  }),
  loader: async () => {
    const { theme } = await getThemeFn();
    return { theme };
  },
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const loaderData = Route.useLoaderData();

  return (
    <RootDocument theme={loaderData?.theme ?? "dark"}>
      <QueryClientProvider client={queryClient}>
        <div className="shell">
          <header className="topbar">
            <Link to="/" className="brand">
              <span className="mark">⚓</span>
              Fish Auction House
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link to="/" activeProps={{ className: "active" }} activeOptions={{ exact: true }}>
                Dashboard
              </Link>
              <Link to="/inventory/new" activeProps={{ className: "active" }}>
                Add fish
              </Link>
              <Link to="/admin" activeProps={{ className: "active" }}>
                Admin
              </Link>
              <a href="/metrics">Metrics</a>
            </nav>
            <div className="topbar-right">
              <ThemeToggle />
            </div>
          </header>
          <nav className="bottom-nav" aria-label="Primary navigation">
            <Link to="/" activeProps={{ className: "active" }} activeOptions={{ exact: true }}>
              <span aria-hidden="true">🏠</span>
              Dashboard
            </Link>
            <Link to="/inventory/new" activeProps={{ className: "active" }}>
              <span aria-hidden="true">🐟</span>
              Add fish
            </Link>
            <Link to="/admin" activeProps={{ className: "active" }}>
              <span aria-hidden="true">📋</span>
              Admin
            </Link>
            <a href="/metrics">
              <span aria-hidden="true">📊</span>
              Metrics
            </a>
          </nav>
          <Outlet />
        </div>
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({
  children,
  theme,
}: Readonly<{ children: ReactNode; theme: "dark" | "light" }>) {
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        {/* Token CSS injected before any component CSS for zero-flash theming */}
        <style dangerouslySetInnerHTML={{ __html: themeTokensCss }} />
        {/* Inline script runs synchronously before hydration to apply the correct theme */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
