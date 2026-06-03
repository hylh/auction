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
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <div className="shell">
          <header className="topbar">
            <Link to="/" className="brand">
              Fish Auction House
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link to="/">Dashboard</Link>
              <Link to="/inventory/new">Add fish</Link>
              <Link to="/admin">Admin</Link>
              <a href="/metrics">Metrics</a>
            </nav>
          </header>
          <Outlet />
        </div>
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
