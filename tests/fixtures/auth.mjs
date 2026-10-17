// One external preload avoids Next dev's rewriting of multiple --import flags.
// Never deploy this file or reference it from app code.
await import("tsx");
await import("./database.mjs");
await import("./turnstile-provider.mjs");
