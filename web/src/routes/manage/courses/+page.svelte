<script lang="ts">
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

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
      <h1 class="text-text-primary text-2xl font-semibold tracking-tight">Course Library</h1>
      <p class="text-text-secondary mt-1 text-sm">
        Manage seeded courses and custom course setups.
      </p>
    </div>
    <div class="flex gap-2">
      <a
        href="/manage/courses/import"
        class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
      >
        Import CSV
      </a>
      <a
        href="/manage/courses/new"
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-lg px-4 text-sm font-semibold transition"
      >
        Add Course
      </a>
    </div>
  </header>

  <form method="GET" class="flex gap-2">
    <input
      name="q"
      type="search"
      value={data.q}
      placeholder="Search courses…"
      class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent flex-1 rounded-lg border px-4 text-sm transition outline-none focus:ring-1"
    />
    <button
      type="submit"
      class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
    >
      Search
    </button>
    {#if data.q}
      <a
        href="/manage/courses"
        class="min-h-touch border-border text-text-secondary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
      >
        Clear
      </a>
    {/if}
  </form>

  {#if data.courses.length === 0}
    <div class="border-border bg-surface rounded-2xl border border-dashed p-8 text-center">
      {#if data.q}
        <p class="text-text-primary text-base font-semibold">No courses match "{data.q}".</p>
        <p class="text-text-secondary mt-2 text-sm">Try a different search term.</p>
      {:else}
        <p class="text-text-primary text-base font-semibold">No courses yet.</p>
        <p class="text-text-secondary mt-2 text-sm">
          Create your first course to unlock round building.
        </p>
        <a
          href="/manage/courses/new"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover mt-5 inline-flex items-center justify-center rounded-lg px-4 text-sm font-semibold transition"
        >
          Add Course
        </a>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each data.courses as course (course.id)}
        <a
          href={`/manage/courses/${course.id}`}
          class="group border-border bg-surface hover:border-border flex min-h-44 flex-col justify-between rounded-2xl border p-4 shadow-sm transition hover:shadow-md md:p-5"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-text-primary group-hover:text-text-primary text-lg font-semibold">
                {course.name}
              </h2>
              {#if course.is_seed === 1}
                <span
                  class="bg-status-up/10 text-status-up inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold tracking-wide uppercase"
                >
                  Seeded
                </span>
              {/if}
            </div>
            <p class="text-text-secondary text-sm">{course.location ?? 'Location not set'}</p>
          </div>

          <div class="text-text-secondary mt-4 flex items-center justify-between text-sm">
            <span>{teeCountLabel(course.teeCount)}</span>
            <span class="text-text-primary font-semibold">View details</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</section>
