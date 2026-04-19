<script lang="ts">
  export type SegmentKey = 'F9' | 'B9' | '18';
  export type SegmentFormat = 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles';
  export type Segment = {
    segment: SegmentKey;
    format: SegmentFormat;
    pointsAtStake: number;
    allowanceOverride: number | null;
    order: number;
  };

  type SegmentShape = 'single18' | 'split' | 'three';

  const FORMAT_OPTIONS: Array<{ value: SegmentFormat; label: string }> = [
    { value: 'Scramble', label: 'Scramble' },
    { value: 'Pinehurst', label: 'Pinehurst' },
    { value: 'Shamble', label: 'Shamble' },
    { value: 'FourBall', label: 'Four-Ball' },
    { value: 'Singles', label: 'Singles' },
  ];

  export let segments: Segment[] = [];
  export let courseHas9HoleRatings = true;
  export let onChange: (nextSegments: Segment[]) => void = () => {};

  function defaultSegment(segment: SegmentKey, order: number): Segment {
    return {
      segment,
      format: 'FourBall',
      pointsAtStake: 1,
      allowanceOverride: null,
      order,
    };
  }

  function normalizeSegment(input: Segment, order: number): Segment {
    return {
      segment: input.segment,
      format: input.format,
      pointsAtStake:
        Number.isFinite(input.pointsAtStake) && input.pointsAtStake > 0 ? input.pointsAtStake : 1,
      allowanceOverride:
        input.allowanceOverride === null ||
        (Number.isFinite(input.allowanceOverride) && input.allowanceOverride >= 0)
          ? input.allowanceOverride
          : null,
      order,
    };
  }

  function segmentLabel(segment: SegmentKey): string {
    if (segment === 'F9') {
      return 'Front 9';
    }

    if (segment === 'B9') {
      return 'Back 9';
    }

    return 'Overall 18';
  }

  function shapeSegments(shape: SegmentShape): SegmentKey[] {
    if (shape === 'single18') {
      return ['18'];
    }

    if (shape === 'split') {
      return ['F9', 'B9'];
    }

    return ['F9', 'B9', '18'];
  }

  function deriveShape(value: Segment[]): SegmentShape {
    const keys = value
      .map((entry) => entry.segment)
      .sort()
      .join('|');

    if (keys === '18') {
      return 'single18';
    }

    if (keys === 'B9|F9') {
      return 'split';
    }

    if (keys === '18|B9|F9') {
      return 'three';
    }

    return 'single18';
  }

  function normalizeSegments(value: Segment[]): Segment[] {
    const sorted = [...value].sort((left, right) => left.order - right.order);

    if (sorted.length === 0) {
      return [defaultSegment('18', 1)];
    }

    return sorted.map((entry, index) => normalizeSegment(entry, index + 1));
  }

  let localSegments: Segment[] = [];
  $: localSegments = normalizeSegments(segments);
  $: shape = deriveShape(localSegments);
  $: splitWarningVisible = !courseHas9HoleRatings && shape !== 'single18';

  function emit(nextSegments: Segment[]): void {
    onChange(nextSegments.map((entry, index) => normalizeSegment(entry, index + 1)));
  }

  function changeShape(nextShape: SegmentShape): void {
    const currentBySegment = new Map<SegmentKey, Segment>(
      localSegments.map((entry) => [entry.segment, entry] satisfies [SegmentKey, Segment])
    );
    const next = shapeSegments(nextShape).map((segmentKey, index) => {
      const existing = currentBySegment.get(segmentKey);
      return existing
        ? normalizeSegment(existing, index + 1)
        : defaultSegment(segmentKey, index + 1);
    });

    emit(next);
  }

  function updateSegment(
    segmentKey: SegmentKey,
    patch: Partial<Pick<Segment, 'format' | 'pointsAtStake' | 'allowanceOverride'>>
  ): void {
    const next = localSegments.map((entry) =>
      entry.segment === segmentKey
        ? {
            ...entry,
            ...patch,
          }
        : entry
    );

    emit(next);
  }

  function readOptionalNumber(value: string): number | null {
    if (value.trim().length === 0) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
</script>

<section class="space-y-4">
  <fieldset class="space-y-3">
    <legend class="text-text-primary text-sm font-semibold">Segment shape</legend>
    <div class="grid gap-3 sm:grid-cols-3">
      <label
        class="min-h-touch border-border bg-surface flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
      >
        <input
          type="radio"
          name="segment-shape"
          checked={shape === 'single18'}
          on:change={() => changeShape('single18')}
          class="border-border text-accent focus:ring-accent h-4 w-4"
        />
        <span class="text-text-primary text-sm font-semibold">Single 18</span>
      </label>

      <label
        class="min-h-touch border-border bg-surface flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
      >
        <input
          type="radio"
          name="segment-shape"
          checked={shape === 'split'}
          on:change={() => changeShape('split')}
          class="border-border text-accent focus:ring-accent h-4 w-4"
        />
        <span class="text-text-primary text-sm font-semibold">Split F9/B9</span>
      </label>

      <label
        class="min-h-touch border-border bg-surface flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
      >
        <input
          type="radio"
          name="segment-shape"
          checked={shape === 'three'}
          on:change={() => changeShape('three')}
          class="border-border text-accent focus:ring-accent h-4 w-4"
        />
        <span class="text-text-primary text-sm font-semibold">F9/B9/Overall</span>
      </label>
    </div>
  </fieldset>

  {#if splitWarningVisible}
    <p
      class="border-status-halved/30 bg-status-halved/10 text-status-halved rounded-lg border px-3 py-2 text-sm font-medium"
    >
      This tee is missing 9-hole ratings, so split formats may not score as expected.
    </p>
  {/if}

  <div class="space-y-3">
    {#each localSegments as segment (segment.segment)}
      <article class="border-border bg-surface-raised space-y-3 rounded-xl border p-4">
        <h3 class="text-text-secondary text-sm font-semibold tracking-wide uppercase">
          {segmentLabel(segment.segment)}
        </h3>

        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Format</span>
            <select
              value={segment.format}
              on:change={(event) =>
                updateSegment(segment.segment, {
                  format: (event.currentTarget as HTMLSelectElement).value as SegmentFormat,
                })}
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            >
              {#each FORMAT_OPTIONS as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Points</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={segment.pointsAtStake}
              on:input={(event) =>
                updateSegment(segment.segment, {
                  pointsAtStake: Number((event.currentTarget as HTMLInputElement).value),
                })}
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>

          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Allowance override % (optional)</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={segment.allowanceOverride ?? ''}
              on:input={(event) =>
                updateSegment(segment.segment, {
                  allowanceOverride: readOptionalNumber(
                    (event.currentTarget as HTMLInputElement).value
                  ),
                })}
              placeholder="Use tournament default"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
        </div>
      </article>
    {/each}
  </div>
</section>
