export const lightTheme = {
  colors: {
    background: "#FFFFFF",
    surface: "#F9FAFB",
    text: "#111827",
    textSecondary: "#6B7280",
    primary: "#4A90D9",
    primaryText: "#FFFFFF",
    border: "#E5E7EB",
    error: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
    card: "#FFFFFF",
    skeleton: "#E5E7EB",
  },
};

export const darkTheme = {
  colors: {
    background: "#111827",
    surface: "#1F2937",
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    primary: "#60A5FA",
    primaryText: "#FFFFFF",
    border: "#374151",
    error: "#F87171",
    success: "#34D399",
    warning: "#FBBF24",
    card: "#1F2937",
    skeleton: "#374151",
  },
};

export type Theme = typeof lightTheme;
