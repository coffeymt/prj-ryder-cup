<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  function teeCountLabel(teeCount: number): string {
    return `${teeCount} ${teeCount === 1 ? 'tee' : 'tees'}`;
  }
</script>

<svelte:head>
  <title>Course Library | Golf Manager</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-6">
  <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-text-primary">Course Library</h1>
      <p class="mt-1 text-sm text-text-secondary">Manage seeded Kiawah courses and custom course setups.</p>
    </div>
    <a
      href="/manage/courses/new"
      class="inline-flex min-h-touch items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
    >
      Add Course
    </a>
  </header>

  {#if data.courses.length === 0}
    <div class="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
      <p class="text-base font-semibold text-text-primary">No courses yet.</p>
      <p class="mt-2 text-sm text-text-secondary">Create your first course to unlock round building.</p>
      <a
        href="/manage/courses/new"
        class="mt-5 inline-flex min-h-touch items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
      >
        Add Course
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each data.courses as course (course.id)}
        <a
          href={`/manage/courses/${course.id}`}
          class="group flex min-h-44 flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-border hover:shadow md:p-5"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-lg font-semibold text-text-primary group-hover:text-text-primary">{course.name}</h2>
              {#if course.is_seed === 1}
                <span class="inline-flex min-h-8 items-center rounded-full bg-status-up/10 px-3 text-xs font-semibold uppercase tracking-wide text-status-up">
                  Kiawah
                </span>
              {/if}
            </div>
            <p class="text-sm text-text-secondary">{course.location ?? 'Location not set'}</p>
          </div>

          <div class="mt-4 flex items-center justify-between text-sm text-text-secondary">
            <span>{teeCountLabel(course.teeCount)}</span>
            <span class="font-semibold text-text-primary">View details</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>
