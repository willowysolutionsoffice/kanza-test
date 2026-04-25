export const APP_CONFIG = {
  name: "Willowy Accounts",
  description: "Petrol Pump Accounting System",
  version: "1.0.0",
  author: {
    name: "Rashid MP",
    url: "https://github.com/rashidmp",
  },

  // Theme and UI settings
  theme: {
    defaultFont: "DM Sans",
    sidebarWidth: "calc(var(--spacing) * 72)",
    headerHeight: "calc(var(--spacing) * 12)",
  },

  // Navigation settings
  navigation: {
    showQuickCreate: false,
    collapsibleSidebar: true,
  },

  siteHeader: {
    defaultTitle: "Dashboard",
    showGitHubLink: false,
  },
} as const;

// Environment-specific configurations
export const isDevelopment = process.env.NODE_ENV === "development";
export const isProduction = process.env.NODE_ENV === "production";

// Export individual config sections for easier imports
export const { theme, navigation } = APP_CONFIG;
