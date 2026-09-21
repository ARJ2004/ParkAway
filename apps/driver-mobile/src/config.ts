const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  console.warn(
    "EXPO_PUBLIC_API_URL is not set — copy .env.example to .env and point it at your dev machine's LAN IP. " +
      "Falling back to http://localhost:3000, which will NOT work from a physical device or most emulators."
  );
}

export const API_URL = apiUrl ?? "http://localhost:3000";
