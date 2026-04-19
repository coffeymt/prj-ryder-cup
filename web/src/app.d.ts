// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env: Env & {
        COOKIE_SIGNING_KEY: string;
        SPECTATOR_COOKIE_KEY: string;
        MAGIC_LINK_KEY: string;
        EMAIL_API_KEY: string;
        FROM_EMAIL: string;
      };
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }

    interface Locals {
      role: 'commissioner' | 'player' | 'spectator' | 'anonymous';
      tournamentId: string | null;
      playerId: string | null;
      userId: string | null;
    }

    // interface Error {}
    // interface PageData {}
    // interface PageState {}
  }
}

export {};
