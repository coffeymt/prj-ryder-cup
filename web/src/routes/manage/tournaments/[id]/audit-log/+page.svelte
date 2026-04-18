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
  <title>{data.tournament.name} Audit Log | Ryder Cup Manager</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-6">
  <header class="space-y-2">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Commissioner Tools</p>
        <h1 class="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Audit log</h1>
        <p class="text-sm text-text-secondary sm:text-base">
          Read-only history of overrides and other administrative actions for
          <span class="font-semibold text-text-primary">{data.tournament.name}</span>.
        </p>
      </div>
      <a
        href={`/manage/tournaments/${data.tournament.id}/overrides`}
        class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
      >
        Back to Overrides
      </a>
    </div>
  </header>

  <section class="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-base font-semibold text-text-primary">Entries</h2>
        <p class="text-sm text-text-secondary">Newest first. Records cannot be edited or deleted from this screen.</p>
      </div>

      <div class="w-full sm:w-64">
        <label for="action-filter" class="text-sm font-semibold text-text-primary">Filter by action type</label>
        <select
          id="action-filter"
          bind:value={actionFilter}
          class="mt-2 block min-h-touch w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="ALL">All action types</option>
          {#each data.actionOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if filteredEntries.length === 0}
      <p class="mt-5 rounded-lg border border-dashed border-border bg-surface-raised px-4 py-6 text-sm text-text-secondary">
        No entries match the selected action type.
      </p>
    {:else}
      <div class="mt-5 space-y-3 md:hidden">
        {#each filteredEntries as entry (entry.id)}
          <article class="rounded-xl border border-border bg-surface-raised p-4">
            <div class="space-y-3 text-sm">
              <div class="flex items-center justify-between gap-2">
                <p class="font-semibold text-text-primary">{entry.actionLabel}</p>
                <p class="text-xs text-text-secondary">{formatTimestamp(entry.createdAt)}</p>
              </div>
              <p class="text-text-primary"><span class="font-semibold text-text-primary">Actor:</span> {entry.actor}</p>
              <p class="break-words text-text-primary">
                <span class="font-semibold text-text-primary">Details:</span> {entry.details}
              </p>
              <p class="break-words text-text-primary">
                <span class="font-semibold text-text-primary">Reason:</span> {entry.reason ?? '—'}
              </p>
            </div>
          </article>
        {/each}
      </div>

      <div class="mt-5 hidden overflow-x-auto md:block">
        <table class="min-w-full divide-y divide-border text-sm">
          <thead class="bg-surface-raised">
            <tr>
              <th scope="col" class="px-3 py-2 text-left font-semibold text-text-primary">Timestamp</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold text-text-primary">Action</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold text-text-primary">Actor</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold text-text-primary">Details</th>
              <th scope="col" class="px-3 py-2 text-left font-semibold text-text-primary">Reason</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/70 bg-surface">
            {#each filteredEntries as entry (entry.id)}
              <tr>
                <td class="whitespace-nowrap px-3 py-3 align-top text-text-primary">{formatTimestamp(entry.createdAt)}</td>
                <td class="whitespace-nowrap px-3 py-3 align-top font-semibold text-text-primary">{entry.actionLabel}</td>
                <td class="whitespace-nowrap px-3 py-3 align-top text-text-primary">{entry.actor}</td>
                <td class="max-w-md break-words px-3 py-3 align-top text-text-primary">{entry.details}</td>
                <td class="max-w-sm break-words px-3 py-3 align-top text-text-primary">{entry.reason ?? '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</section>
