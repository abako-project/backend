import { WebAuthnEmulator } from 'nid-webauthn-emulator';
import { WebSocket } from 'ws';

// Polyfill WebSocket for Node.js environment
(global as any).WebSocket = WebSocket;

// Polyfill localStorage for Node.js environment
(global as any).localStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] || null;
  },
  setItem(key: string, value: string) {
    this.store[key] = value;
  },
  removeItem(key: string) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  },
};

const ORIGIN = 'https://example.com';
const emulator = new WebAuthnEmulator();

// Polyfill navigator.credentials for server-side tests
Object.defineProperty(global, 'navigator', {
  configurable: true,
  value: {
    credentials: {
      create: async (options: any) =>
        emulator.create(ORIGIN, options),
      get: async (options: any) =>
        emulator.get(ORIGIN, options),
    },
  },
});

(global as any).webAuthnEmulator = emulator;

