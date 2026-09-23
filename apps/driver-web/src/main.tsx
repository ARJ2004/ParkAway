import "@parkaway/ui-web/src/base.css";
import { multiThemeToCss } from "@parkaway/design-tokens";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

// Driver, owner ("host") and the Property Manager Console's theme (reuses
// `admin` deliberately — same design family as the internal admin console,
// see OwnerAppShell/PropertyManagerShell) are all present in the page from
// boot — switching mode is then just a `data-theme` attribute flip (see
// theme.ts's setActiveTheme), never a style-tag replacement or a flash of
// the wrong palette. `:root` (unscoped) defaults to `driver`.
const styleTag = document.createElement("style");
styleTag.textContent = multiThemeToCss(["driver", "host", "admin"]);
document.head.appendChild(styleTag);
document.documentElement.setAttribute("data-theme", "driver");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
