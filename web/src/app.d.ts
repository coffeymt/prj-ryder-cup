// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env: Env;
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
