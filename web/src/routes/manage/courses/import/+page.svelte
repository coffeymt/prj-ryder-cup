<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData | null } = $props();

  let isSubmitting = $state(false);
  let fileName = $state<string | null>(null);

  const singleError = $derived(
    form && 'error' in form && typeof form.error === 'string' ? form.error : null
  );
  const validationErrors = $derived(
    form && 'errors' in form && Array.isArray(form.errors)
      ? (form.errors as Array<{ row: number; field: string; message: string }>)
      : []
  );

  const TEMPLATE_CSV = buildTemplateCsv();

  function buildTemplateCsv(): string {
    // Realistic 18-hole par/SI layout mirroring the sample data in the task
    const PARS = [4, 5, 3, 4, 4, 3, 4, 4, 5, 4, 4, 3, 4, 5, 3, 4, 4, 5];
    const SIS = [7, 3, 15, 11, 1, 17, 9, 5, 13, 8, 4, 16, 12, 2, 18, 10, 6, 14];
    const YDS_BLUE = [
      395, 543, 175, 435, 425, 195, 380, 510, 480, 400, 420, 185, 375, 555, 155, 415, 395, 500,
    ];
    const YDS_WHITE = [
      370, 510, 155, 410, 400, 170, 355, 485, 455, 375, 395, 160, 350, 530, 130, 390, 370, 475,
    ];

    const header =
      'CourseName,CourseLocation,TeeName,TeeColor,CR18,Slope18,Par18,CR9F,Slope9F,Par9F,CR9B,Slope9B,Par9B,HoleNumber,Par,Yardage,StrokeIndex\n';
    let rows = header;

    for (let h = 1; h <= 18; h++) {
      rows += `Example Course,City ST,Blue,#0000FF,73.2,141,72,36.5,138,36,36.7,144,36,${h},${PARS[h - 1]},${YDS_BLUE[h - 1]},${SIS[h - 1]}\n`;
    }
    for (let h = 1; h <= 18; h++) {
      rows += `Example Course,City ST,White,#FFFFFF,71.1,134,72,35.2,131,36,35.9,137,36,${h},${PARS[h - 1]},${YDS_WHITE[h - 1]},${SIS[h - 1]}\n`;
    }

    return rows;
  }

  function downloadTemplate(): void {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'course-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    fileName = input.files?.[0]?.name ?? null;
  }

  const submitEnhance: SubmitFunction = () => {
    isSubmitting = true;
    return async ({ update }) => {
      isSubmitting = false;
      await update();
    };
  };

  const FORMAT_COLUMNS = [
    ['CourseName', 'Yes', 'Course name — must be the same on every row in the file'],
    ['CourseLocation', 'No', 'Location description (e.g. "Kiawah Island, SC")'],
    ['TeeName', 'Yes', 'Tee name (e.g. Blue, White, Red). Each tee needs exactly 18 rows.'],
    ['TeeColor', 'No', 'Hex color code for the tee marker (e.g. #0000FF)'],
    ['CR18', 'Yes', 'Course rating for 18 holes (decimal, e.g. 73.2)'],
    ['Slope18', 'Yes', 'Slope rating for 18 holes (integer 1–155)'],
    ['Par18', 'Yes', 'Total par for 18 holes (integer)'],
    ['CR9F', 'No', 'Course rating for the front 9 (decimal)'],
    ['Slope9F', 'No', 'Slope rating for the front 9 (integer)'],
    ['Par9F', 'No', 'Par for the front 9 (integer)'],
    ['CR9B', 'No', 'Course rating for the back 9 (decimal)'],
    ['Slope9B', 'No', 'Slope rating for the back 9 (integer)'],
    ['Par9B', 'No', 'Par for the back 9 (integer)'],
    ['HoleNumber', 'Yes', 'Hole number (1–18). Every hole must appear exactly once per tee.'],
    ['Par', 'Yes', 'Hole par (3, 4, or 5)'],
    ['Yardage', 'No', 'Hole yardage (integer)'],
    ['StrokeIndex', 'Yes', 'Handicap stroke order (1–18). Each value must be unique within a tee.'],
  ] as const;
</script>

<svelte:head>
  <title>Import Course | Golf Manager</title>
</svelte:head>

<section class="mx-auto w-full max-w-3xl space-y-6">
  <header class="space-y-2">
    <a
      href="/manage/courses"
      class="min-h-touch text-text-secondary hover:text-text-primary inline-flex items-center text-sm font-medium"
    >
      ← Back to courses
    </a>
    <h1 class="text-text-primary text-2xl font-semibold tracking-tight">Import Course from CSV</h1>
    <p class="text-text-secondary text-sm">
      Upload a CSV file to bulk-import a course with all tees and holes in a single step.
    </p>
  </header>

  {#if singleError}
    <p
      class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-4 py-3 text-sm font-medium"
    >
      {singleError}
    </p>
  {/if}

  {#if validationErrors.length > 0}
    <div class="border-status-down/30 bg-status-down/10 rounded-lg border p-4">
      <p class="text-status-down mb-2 text-sm font-semibold">
        {validationErrors.length}
        {validationErrors.length === 1 ? 'validation error' : 'validation errors'} found:
      </p>
      <ul class="text-status-down space-y-1 text-sm">
        {#each validationErrors as err (err.row + '-' + err.field)}
          <li>
            {#if err.row > 0}<span class="font-medium">Row {err.row}</span> —
            {/if}<strong>{err.field}:</strong>
            {err.message}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <form method="POST" enctype="multipart/form-data" use:enhance={submitEnhance} class="space-y-6">
    <div class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
      <h2 class="text-text-primary text-lg font-semibold">Upload CSV File</h2>
      <p class="text-text-secondary mt-1 text-sm">Maximum file size: 1 MB.</p>

      <label class="mt-4 block">
        <span class="text-text-primary text-sm font-semibold">CSV File</span>
        <div class="mt-2">
          <input
            type="file"
            name="csv"
            accept=".csv,text/csv"
            required
            onchange={handleFileChange}
            class="text-text-primary file:bg-surface-raised file:text-text-primary file:border-border file:hover:bg-accent file:hover:text-accent-text w-full cursor-pointer text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border file:px-4 file:py-2 file:text-sm file:font-semibold file:transition"
          />
        </div>
        {#if fileName}
          <p class="text-text-secondary mt-2 text-sm">Selected: {fileName}</p>
        {/if}
      </label>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onclick={downloadTemplate}
        class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-xl border bg-transparent px-4 text-sm font-semibold transition"
      >
        Download Template CSV
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-xl px-6 text-sm font-semibold shadow-md transition disabled:opacity-50"
      >
        {isSubmitting ? 'Importing…' : 'Import Course'}
      </button>
    </div>
  </form>

  <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
    <h2 class="text-text-primary text-lg font-semibold">CSV Format Reference</h2>
    <p class="text-text-secondary mt-2 text-sm">
      One row per hole per tee. Each tee must have exactly 18 rows (hole numbers 1–18). Stroke index
      values must be unique within each tee (1–18, each used exactly once). The file must describe a
      single course.
    </p>

    <div class="mt-4 overflow-x-auto rounded-lg">
      <table class="border-border w-full border-collapse text-sm">
        <thead>
          <tr class="bg-surface-raised">
            <th class="border-border text-text-primary border px-3 py-2 text-left font-semibold">
              Column
            </th>
            <th class="border-border text-text-primary border px-3 py-2 text-left font-semibold">
              Required
            </th>
            <th class="border-border text-text-primary border px-3 py-2 text-left font-semibold">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {#each FORMAT_COLUMNS as [col, req, desc] (col)}
            <tr class="border-border even:bg-surface-raised border-b">
              <td class="border-border border px-3 py-2 font-mono text-xs">{col}</td>
              <td class="border-border text-text-secondary border px-3 py-2 text-xs">{req}</td>
              <td class="border-border text-text-secondary border px-3 py-2">{desc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="mt-5">
      <p class="text-text-secondary text-xs font-semibold tracking-wide uppercase">
        Example (first 2 of 18 rows for each tee)
      </p>
      <pre
        class="bg-surface-raised border-border mt-2 overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-relaxed"><code
          >CourseName,CourseLocation,TeeName,TeeColor,CR18,Slope18,Par18,CR9F,Slope9F,Par9F,CR9B,Slope9B,Par9B,HoleNumber,Par,Yardage,StrokeIndex
Kiawah Ocean,Kiawah Island SC,Blue,#0000FF,73.2,141,72,36.5,138,36,36.7,144,36,1,4,395,7
Kiawah Ocean,Kiawah Island SC,Blue,#0000FF,73.2,141,72,36.5,138,36,36.7,144,36,2,5,543,3
… (18 rows total for Blue tee)
Kiawah Ocean,Kiawah Island SC,White,#FFFFFF,71.1,134,72,35.2,131,36,35.9,137,36,1,4,370,7
Kiawah Ocean,Kiawah Island SC,White,#FFFFFF,71.1,134,72,35.2,131,36,35.9,137,36,2,5,510,3
… (18 rows total for White tee)</code
        ></pre>
    </div>
  </section>
</section>
