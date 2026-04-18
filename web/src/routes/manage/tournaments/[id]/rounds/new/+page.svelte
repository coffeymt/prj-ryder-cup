<script lang="ts">
  import MatchupBuilder, { type Matchup } from '$lib/ui/MatchupBuilder.svelte';
  import SegmentConfig, { type Segment } from '$lib/ui/SegmentConfig.svelte';
  import type { ActionData, PageData } from './$types';

  type FormState = {
    error?: string;
    createdRoundId?: string;
    values?: Partial<{
      roundName: string;
      courseId: string;
      teeId: string;
      dateTime: string;
      segmentsJson: string;
      matchupsJson: string;
    }>;
  };

  export let data: PageData;
  export let form: ActionData | undefined;

  const DEFAULT_SEGMENTS: Segment[] = [
    {
      segment: '18',
      format: 'FourBall',
      pointsAtStake: 1,
      allowanceOverride: null,
      order: 1
    }
  ];

  let formState: FormState | undefined;
  $: formState = form as FormState | undefined;

  let currentStep = 1;
  let localError: string | null = null;

  let roundName = '';
  let selectedCourseId = data.courses[0]?.id ?? '';
  let selectedTeeId = '';
  let dateTime = defaultDateTimeValue();
  let segments: Segment[] = [...DEFAULT_SEGMENTS];
  let matchups: Matchup[] = [];

  $: if (formState?.values) {
    roundName = formState.values.roundName ?? roundName;
    selectedCourseId = formState.values.courseId ?? selectedCourseId;
    selectedTeeId = formState.values.teeId ?? selectedTeeId;
    dateTime = formState.values.dateTime ?? dateTime;

    if (formState.values.segmentsJson) {
      const parsedSegments = parseSegmentsJson(formState.values.segmentsJson);
      if (parsedSegments.length > 0) {
        segments = parsedSegments;
      }
    }

    if (formState.values.matchupsJson) {
      const parsedMatchups = parseMatchupsJson(formState.values.matchupsJson);
      if (parsedMatchups.length > 0) {
        matchups = parsedMatchups;
      }
    }
  }

  $: selectedCourse = data.courses.find((course) => course.id === selectedCourseId) ?? null;
  $: availableTees = selectedCourse?.tees ?? [];

  $: if (availableTees.length > 0 && !availableTees.some((tee) => tee.id === selectedTeeId)) {
    selectedTeeId = availableTees[0].id;
  }

  $: if (availableTees.length === 0) {
    selectedTeeId = '';
  }

  $: selectedTee = availableTees.find((tee) => tee.id === selectedTeeId) ?? null;
  $: courseHas9HoleRatings = selectedTee ? teeHasNineHoleRatings(selectedTee) : false;
  $: currentRoundPoints = segments.reduce((sum, segment) => sum + segment.pointsAtStake, 0);
  $: configuredPoints = data.existingConfiguredPoints + currentRoundPoints;
  $: validMatchups = matchups.filter((row) => row.sideAPlayerIds.length > 0 && row.sideBPlayerIds.length > 0);
  $: segmentsJson = JSON.stringify(segments);
  $: matchupsJson = JSON.stringify(validMatchups);
  $: duplicatePlayerIds = findDuplicatePlayers(validMatchups);

  function defaultDateTimeValue(): string {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    return toInputDateTime(date.toISOString());
  }

  function toInputDateTime(value: string): string {
    const parsed = Date.parse(value);

    if (Number.isNaN(parsed)) {
      return '';
    }

    const date = new Date(parsed);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function parseSegmentsJson(rawValue: string): Segment[] {
    try {
      const parsed = JSON.parse(rawValue) as Segment[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parseMatchupsJson(rawValue: string): Matchup[] {
    try {
      const parsed = JSON.parse(rawValue) as Matchup[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function teeHasNineHoleRatings(tee: {
    cr9f: number | null;
    slope9f: number | null;
    par9f: number | null;
    cr9b: number | null;
    slope9b: number | null;
    par9b: number | null;
  }): boolean {
    return (
      tee.cr9f !== null &&
      tee.slope9f !== null &&
      tee.par9f !== null &&
      tee.cr9b !== null &&
      tee.slope9b !== null &&
      tee.par9b !== null
    );
  }

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function isSplitShape(configuredSegments: Segment[]): boolean {
    const keys = configuredSegments.map((segment) => segment.segment).sort().join('|');
    return keys !== '18';
  }

  function findDuplicatePlayers(rows: Matchup[]): Set<string> {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const row of rows) {
      for (const playerId of [...row.sideAPlayerIds, ...row.sideBPlayerIds]) {
        if (seen.has(playerId)) {
          duplicates.add(playerId);
          continue;
        }

        seen.add(playerId);
      }
    }

    return duplicates;
  }

  function validateStep(step: number): string | null {
    if (step === 1) {
      if (!roundName.trim()) {
        return 'Round name is required.';
      }

      if (!selectedCourseId) {
        return 'Select a course.';
      }

      if (!selectedTeeId) {
        return 'Select a tee.';
      }

      if (!dateTime || Number.isNaN(Date.parse(dateTime))) {
        return 'Enter a valid date and time.';
      }

      return null;
    }

    if (step === 2) {
      if (segments.length === 0) {
        return 'Configure at least one segment.';
      }

      if (segments.some((segment) => !Number.isFinite(segment.pointsAtStake) || segment.pointsAtStake <= 0)) {
        return 'Each segment must have positive points.';
      }

      if (isSplitShape(segments) && !courseHas9HoleRatings) {
        return 'Selected tee lacks 9-hole ratings required for split formats.';
      }

      return null;
    }

    if (!data.teamA || !data.teamB) {
      return 'Create two teams before building matchups.';
    }

    if (validMatchups.length === 0) {
      return 'Add at least one complete pairing before saving.';
    }

    if (duplicatePlayerIds.size > 0) {
      return 'Each player can only appear in one pairing.';
    }

    return null;
  }

  function goToNextStep(): void {
    localError = validateStep(currentStep);

    if (localError) {
      return;
    }

    currentStep = Math.min(3, currentStep + 1);
  }

  function goToPreviousStep(): void {
    localError = null;
    currentStep = Math.max(1, currentStep - 1);
  }

  function handleSubmit(event: SubmitEvent): void {
    localError = validateStep(3);

    if (localError) {
      event.preventDefault();
      return;
    }
  }

  function stepButtonClasses(step: number): string {
    if (step === currentStep) {
      return 'border-accent bg-accent text-accent-text';
    }

    return 'border-border bg-surface text-text-primary';
  }
</script>

<svelte:head>
  <title>New Round | Ryder Cup Manager</title>
</svelte:head>

<section class="space-y-5">
  <header class="space-y-2">
    <a
      href={`/manage/tournaments/${data.tournament.id}/rounds`}
      class="inline-flex min-h-touch items-center text-sm font-medium text-text-secondary hover:text-text-primary"
    >
      ← Back to rounds
    </a>
    <h1 class="text-2xl font-semibold tracking-tight text-text-primary">Build round</h1>
    <p class="text-sm text-text-secondary">Configure round basics, formats, and pairings in one flow.</p>
  </header>

  <p class="sticky top-0 z-20 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-text-primary shadow-sm">
    {formatPoints(configuredPoints)} / {formatPoints(data.targetPoints)} points configured
  </p>

  {#if localError}
    <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm font-medium text-status-down">{localError}</p>
  {/if}

  {#if formState?.error}
    <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm font-medium text-status-down">
      {formState.error}
    </p>
  {/if}

  {#if formState?.createdRoundId}
    <p class="rounded-lg border border-status-halved/30 bg-status-halved/10 px-3 py-2 text-sm text-status-halved">
      Round was created but matchup creation failed.
      <a
        href={`/manage/tournaments/${data.tournament.id}/rounds/${formState.createdRoundId}`}
        class="font-semibold underline"
      >
        Open round
      </a>
      to finish setup.
    </p>
  {/if}

  <div class="grid grid-cols-3 gap-2">
    <button type="button" class={`min-h-touch rounded-lg border text-sm font-medium ${stepButtonClasses(1)}`}>1. Basics</button>
    <button type="button" class={`min-h-touch rounded-lg border text-sm font-medium ${stepButtonClasses(2)}`}>2. Segments</button>
    <button type="button" class={`min-h-touch rounded-lg border text-sm font-medium ${stepButtonClasses(3)}`}>3. Matchups</button>
  </div>

  <form method="POST" class="space-y-5" on:submit={handleSubmit}>
    <input type="hidden" name="roundName" value={roundName} />
    <input type="hidden" name="courseId" value={selectedCourseId} />
    <input type="hidden" name="teeId" value={selectedTeeId} />
    <input type="hidden" name="dateTime" value={dateTime} />
    <input type="hidden" name="segmentsJson" value={segmentsJson} />
    <input type="hidden" name="matchupsJson" value={matchupsJson} />

    {#if currentStep === 1}
      <section class="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <h2 class="text-lg font-semibold text-text-primary">Step 1: Round basics</h2>

        <label class="space-y-1 text-sm text-text-primary">
          <span class="font-medium">Round name</span>
          <input
            type="text"
            bind:value={roundName}
            placeholder="Cougar Point"
            class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            required
          />
        </label>

        <label class="space-y-1 text-sm text-text-primary">
          <span class="font-medium">Course</span>
          <select
            bind:value={selectedCourseId}
            class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            required
          >
            {#each data.courses as course (course.id)}
              <option value={course.id}>{course.name}</option>
            {/each}
          </select>
        </label>

        <label class="space-y-1 text-sm text-text-primary">
          <span class="font-medium">Tee</span>
          <select
            bind:value={selectedTeeId}
            class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            required
            disabled={availableTees.length === 0}
          >
            {#if availableTees.length === 0}
              <option value="">No tees available</option>
            {:else}
              {#each availableTees as tee (tee.id)}
                <option value={tee.id}>{tee.name}</option>
              {/each}
            {/if}
          </select>
        </label>

        <label class="space-y-1 text-sm text-text-primary">
          <span class="font-medium">Date &amp; time</span>
          <input
            type="datetime-local"
            bind:value={dateTime}
            class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            required
          />
        </label>
      </section>
    {/if}

    {#if currentStep === 2}
      <section class="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <h2 class="text-lg font-semibold text-text-primary">Step 2: Segment configuration</h2>
        <SegmentConfig
          segments={segments}
          courseHas9HoleRatings={courseHas9HoleRatings}
          onChange={(nextSegments) => (segments = nextSegments)}
        />
      </section>
    {/if}

    {#if currentStep === 3}
      <section class="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <h2 class="text-lg font-semibold text-text-primary">Step 3: Matchups</h2>

        {#if data.teamA && data.teamB}
          <MatchupBuilder
            teamA={data.teamA}
            teamB={data.teamB}
            teamAPlayers={data.teamAPlayers}
            teamBPlayers={data.teamBPlayers}
            value={matchups}
            onChange={(nextMatchups) => (matchups = nextMatchups)}
          />
        {:else}
          <p class="rounded-lg border border-status-halved/30 bg-status-halved/10 px-3 py-2 text-sm font-medium text-status-halved">
            Create two teams before adding round matchups.
          </p>
        {/if}
      </section>
    {/if}

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        on:click={goToPreviousStep}
        disabled={currentStep === 1}
        class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:text-text-secondary"
      >
        Back
      </button>

      {#if currentStep < 3}
        <button
          type="button"
          on:click={goToNextStep}
          class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
        >
          Next
        </button>
      {:else}
        <button
          type="submit"
          class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
        >
          Create Round
        </button>
      {/if}
    </div>
  </form>
</section>
