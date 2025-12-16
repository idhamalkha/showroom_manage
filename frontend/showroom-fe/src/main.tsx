import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";  // Base variables and themes first
import './styles/theme-toggle.css';
import './styles/sidebar.css';
import './styles/layout.css';

// Force light theme immediately before React mounts to avoid flash and disable dark mode
(() => {
  try {
    // Always use light theme. Clear any stored preference that enables dark.
    try { localStorage.removeItem('darkMode'); } catch {}
    try { localStorage.setItem('theme', 'light'); } catch {}
    document.documentElement.classList.remove('dark');
    document.body.setAttribute('data-theme', 'light');
  } catch (e) {
    /* ignore */
  }
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    },
  },
});

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);