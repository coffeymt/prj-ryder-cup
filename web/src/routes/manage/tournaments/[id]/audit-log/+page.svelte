<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  let actionFilter = 'ALL';

  $: filteredEntries =
    actionFilter === 'ALL'
      ? data.entries
      : data.entries.filter((entry) => entry.action === actionFilter);

  function formatTimestamp(isoValue: string): string {
    const parsed = new Date(isoValue);

    if (Number.isNaN(parsed.getTime())) {
      return isoValue;
    }

    return parsed.toLocaleString();
  }
</script>

<svelte:head>
  <title>{data.tournament.name} Audit Log | Golf Manager</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-6">
  <header class="space-y-2">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-2">
        <p class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase">
          Commissioner Tools
        </p>
        <h1 class="text-text-primary text-2xl font-semibold tracking-tight sm:text-3xl">
          Audit log
        </h1>
        <p class="text-text-secondary text-sm sm:text-base">
          Read-only history of overrides and other administrative actions for
          <span class="text-text-primary font-semibold">{data.tournament.name}</span>.
        </p>
      </div>
      <a
        href={`/manage/tournaments/${data.tournament.id}/overrides`}
        class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
      >
        Back to Overrides
      </a>
    </div>
  </header>

  <section class="border-border bg-surface rounded-2xl border p-5 shadow-sm sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-text-primary text-base font-semibold">Entries</h2>
        <p class="text-text-secondary text-sm">
          Newest first. Records cannot be edited or deleted from this screen.
        </p>
      </div>

      <div class="w-full sm:w-64">
        <label for="action-filter" class="text-text-primary text-sm font-semibold"
          >Filter by action type</label
        >
        <select
          id="action-filter"
          bind:value={actionFilter}
          class="min-h-touch border-border bg-surface text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
        >
          <option value="ALL">All action types</option>
          {#each data.actionOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if filteredEntries.length === 0}
      <p
        class="border-border bg-surface-raised text-text-secondary mt-5 rounded-lg border border-dashed px-4 py-6 text-sm"
      >
        No entries match the selected action type.
      </p>
    {:else}
      <div class="mt-5 space-y-3 md:hidden">
        {#each filteredEntries as entry (entry.id)}
          <article class="border-border bg-surface-raised rounded-xl border p-4">
            <div class="space-y-3 text-sm">
              <div class="flex items-center justify-between gap-2">
                <p class="text-text-primary font-semibold">{entry.actionLabel}</p>
                <p class="text-text-secondary text-xs">{formatTimestamp(entry.createdAt)}</p>
              </div>
              <p class="text-text-primary">
                <span class="text-text-primary font-semibold">Actor:</span>
                {entry.actor}
              </p>
              <p class="text-text-primary break-words">
                <span class="text-text-primary font-semibold">Details:</span>
                {entry.details}
              </p>
              <p class="text-text-primary break-words">
                <span class="text-text-primary font-semibold">Reason:</span>
                {entry.reason ?? '—'}
              </p>
            </div>
          </article>
        {/each}
      </div>

      <div class="mt-5 hidden overflow-x-auto md:block">
        <table class="divide-border min-w-full divide-y text-sm">
          <thead class="bg-surface-raised">
            <tr>
              <th scope="col" class="text-text-primary px-3 py-2 text-left font-semibold"
                >Timestamp</th
              >
              <th scope="col" class="text-text-primary px-3 py-2 text-left font-semibold">Action</th
              >
              <th scope="col" class="text-text-primary px-3 py-2 text-left font-semibold">Actor</th>
              <th scope="col" class="text-text-primary px-3 py-2 text-left font-semibold"
                >Details</th
              >
              <th scope="col" class="text-text-primary px-3 py-2 text-left font-semibold">Reason</th
              >
            </tr>
          </thead>
          <tbody class="divide-border/70 bg-surface divide-y">
            {#each filteredEntries as entry (entry.id)}
              <tr>
                <td class="text-text-primary px-3 py-3 align-top whitespace-nowrap"
                  >{formatTimestamp(entry.createdAt)}</td
                >
                <td class="text-text-primary px-3 py-3 align-top font-semibold whitespace-nowrap"
                  >{entry.actionLabel}</td
                >
                <td class="text-text-primary px-3 py-3 align-top whitespace-nowrap"
                  >{entry.actor}</td
                >
                <td class="text-text-primary max-w-md px-3 py-3 align-top break-words"
                  >{entry.details}</td
                >
                <td class="text-text-primary max-w-sm px-3 py-3 align-top break-words"
                  >{entry.reason ?? '—'}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</section>
