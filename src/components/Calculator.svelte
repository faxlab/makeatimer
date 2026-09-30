<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Tool, Values, Result, Field } from '../lib/types';
  import { decodeShare } from '../lib/share';
  import InputField from './InputField.svelte';
  import Actions from './Actions.svelte';
  let { tool } = $props<{ tool: Tool }>();
  const defaults: Values = untrack(() =>
    Object.fromEntries(tool.fields.map((f: Field) => [f.key, f.default])),
  );
  let values = $state<Values>({ ...defaults });
  let engine = $state<((id: string, values: Values) => Result) | undefined>();
  let warning = $state('');
  let loaded = $state(false);
  let output = $derived.by(() => {
    if (!engine) return { result: tool.defaultResult, error: '' };
    try {
      return { result: engine(tool.id, values), error: '' };
    } catch (e) {
      return {
        result: null,
        error: (e as Error).message || 'Check your inputs.',
      };
    }
  });
  $effect(() => {
    document.body.classList.toggle('tool-error', !!output.error);
    return () => document.body.classList.remove('tool-error');
  });
  onMount(() => {
    let alive = true;
    const restore = () => {
      const decoded = decodeShare(location.hash, defaults);
      values = decoded.values;
      warning = decoded.warning;
    };
    restore();
    window.addEventListener('hashchange', restore);
    const module =
      tool.engine === 'calendar'
        ? import('../lib/calendar')
        : tool.engine === 'rates'
          ? import('../lib/rates')
          : import('../lib/work');
    module
      .then((m) => {
        if (alive) {
          engine = m.calculate;
          loaded = true;
        }
      })
      .catch(() => {
        warning = 'The calculator could not load. Refresh to try again.';
      });
    return () => {
      alive = false;
      window.removeEventListener('hashchange', restore);
    };
  });
  function exportCsv() {
    if (!output.result?.csv) return;
    const url = URL.createObjectURL(
      new Blob([output.result.csv], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weekly-timesheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<section class="calculator-card" aria-label={`${tool.name} calculator`}>
  {#if warning}<p class="notice" role="status">{warning}</p>{/if}
  <div
    class="calculator-workspace"
    class:timesheet-workspace={tool.id === 'timesheet'}
  >
    <div class="input-panel">
      <h2 class="panel-title">Inputs</h2>
      <form onsubmit={(e) => e.preventDefault()}>
        {#if tool.id === 'timesheet'}
          <div class="timesheet">
            <div class="timesheet-headings" aria-hidden="true">
              <span>Day</span><span>Clock in</span><span>Clock out</span><span
                >Break (min)</span
              ><span>End day</span>
            </div>
            {#each ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as day, i}
              <div
                class="timesheet-day"
                role="group"
                aria-labelledby={`day-${i}`}
              >
                <h3 id={`day-${i}`}>{day}</h3>
                <div class="timesheet-row">
                  {#each tool.fields.slice(i * 4, i * 4 + 4) as field}<InputField
                      {field}
                      bind:value={values[field.key]}
                    />{/each}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="form-grid">
            {#each tool.fields as field}<InputField
                {field}
                bind:value={values[field.key]}
              />{/each}
          </div>
        {/if}
      </form>
    </div>
    <div class="result-column">
      <div class="result-panel" aria-live="polite" aria-atomic="true">
        <h2 class="panel-title">Result</h2>
        {#if output.error}<p class="error" role="alert">
            {output.error}
          </p>{:else if output.result}
          <output class="result-value">{output.result.value}</output>
          <p>{output.result.detail}</p>
          {#if output.result.rows?.length}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll wide result tables.) -->
            <div
              class="result-table"
              class:meeting-slots={tool.id === 'meeting-planner'}
              role="region"
              aria-label="Result details"
              tabindex="0"
            >
              <table>
                <caption class="sr-only">Result details</caption><tbody
                  >{#each output.result.rows as [name, value]}<tr
                      ><th scope="row">{name}</th><td>{value}</td></tr
                    >{/each}</tbody
                >
              </table>
            </div>{/if}
          {#if output.result.csv}<button class="secondary" onclick={exportCsv}
              >Download CSV</button
            >{/if}
        {/if}
      </div>
      <Actions
        {values}
        path={`/${tool.id}/`}
        text={output.result
          ? `${output.result.value}\n${output.result.detail}${output.result.rows ? `\n${output.result.rows.map((r: [string, string]) => r.join(': ')).join('\n')}` : ''}`
          : ''}
        disabled={!loaded || !output.result}
      />
    </div>
  </div>
</section>
