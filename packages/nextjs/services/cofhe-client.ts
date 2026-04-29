"use client";

import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { chains } from "@cofhe/sdk/chains";

type CofheClientInstance = ReturnType<typeof createCofheClient>;

let _instance: CofheClientInstance | null = null;

function createInstance(): CofheClientInstance {
  const config = createCofheConfig({
    supportedChains: [chains.arbSepolia, chains.baseSepolia, chains.sepolia],
  });
  return createCofheClient(config);
}

/**
 * Returns the singleton cofhe client instance. Throws if called server-side.
 * Lazy instantiation avoids `indexedDB is not defined` during Next.js SSR builds.
 */
export function getCofheClient(): CofheClientInstance {
  if (typeof window === "undefined") {
    throw new Error("CoFHE client is only available in browser context");
  }
  if (!_instance) {
    _instance = createInstance();
  }
  return _instance;
}

/**
 * Proxy wrapper so that modules can `import { cofheClient }` at module level in "use client"
 * components without triggering the underlying `createCofheClient` during SSR pre-render.
 */
export const cofheClient = new Proxy({} as CofheClientInstance, {
  get(_target, prop) {
    return getCofheClient()[prop as keyof CofheClientInstance];
  },
});
