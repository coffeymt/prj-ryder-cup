<script lang="ts">
  export let matchState = 'Not started';
  export let teamAName = 'Team A';
  export let teamBName = 'Team B';
  export let teamAColor = '';
  export let teamBColor = '';

  function headerStyle(primaryColor: string, secondaryColor: string): string {
    return `--color-team-a: ${primaryColor || 'var(--color-team-a)'}; --color-team-b: ${secondaryColor || 'var(--color-team-b)'};`;
  }

  function stateCueText(label: string): string {
    const normalized = label.toUpperCase();

    if (normalized.includes(' DN')) {
      return 'DN';
    }

    if (normalized.includes(' UP')) {
      return 'UP';
    }

    if (normalized.includes('AS') || normalized.includes('HALVED') || normalized.startsWith('T')) {
      return 'AS';
    }

    return 'STATE';
  }

  function stateTone(label: string): 'up' | 'down' | 'halved' | 'closed' {
    const normalized = label.toUpperCase();

    if (normalized.includes(' DN')) {
      return 'down';
    }

    if (normalized.includes(' UP')) {
      return 'up';
    }

    if (normalized.includes('AS') || normalized.includes('HALVED') || normalized.startsWith('T')) {
      return 'halved';
    }

    return 'closed';
  }

  function stateTextClasses(label: string): string {
    const tone = stateTone(label);

    if (tone === 'down') {
      return 'text-status-down';
    }

    if (tone === 'up') {
      return 'text-status-up';
    }

    if (tone === 'halved') {
      return 'text-status-halved';
    }

    return 'text-status-closed';
  }

  function statePillClasses(label: string): string {
    const tone = stateTone(label);

    if (tone === 'down') {
      return 'bg-status-down/10 text-status-down';
    }

    if (tone === 'up') {
      return 'bg-status-up/10 text-status-up';
    }

    if (tone === 'halved') {
      return 'bg-status-halved/10 text-status-halved';
    }

    return 'bg-status-closed/10 text-status-closed';
  }
</script>

<header
  class="border-border bg-surface-glass sticky top-0 z-20 space-y-2 rounded-2xl border p-3 shadow-md backdrop-blur-md"
  style={headerStyle(teamAColor, teamBColor)}
>
  <div class="flex items-center justify-between gap-2">
    <p class={`font-display text-2xl font-semibold tracking-tight ${stateTextClasses(matchState)}`}>
      {matchState}
    </p>
    <span class={`rounded-full px-2.5 py-1 text-xs font-semibold ${statePillClasses(matchState)}`}>
      {stateCueText(matchState)}
    </span>
  </div>
  <div class="grid grid-cols-2 gap-2">
    <p
      class="min-h-touch border-border bg-surface-raised text-text-primary flex items-center gap-2 rounded-full border px-3 text-sm font-semibold"
    >
      <span class="border-border bg-team-a h-2.5 w-2.5 rounded-full border" aria-hidden="true"
      ></span>
      <span class="truncate">{teamAName}</span>
    </p>
    <p
      class="min-h-touch border-border bg-surface-raised text-text-primary flex items-center gap-2 rounded-full border px-3 text-sm font-semibold"
    >
      <span class="border-border bg-team-b h-2.5 w-2.5 rounded-full border" aria-hidden="true"
      ></span>
      <span class="truncate">{teamBName}</span>
    </p>
  </div>
</header>
