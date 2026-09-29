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
      tool.category === 'Calendar & zones'
        ? import('../lib/calendar')
        : tool.category === 'Specialist'
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
  <form onsubmit={(e) => e.preventDefault()}>
    {#if tool.id === 'timesheet'}
      <div class="timesheet">
        {#each ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as day, i}
          <fieldset>
            <legend>{day}</legend>
            <div class="timesheet-row">
              {#each tool.fields.slice(i * 4, i * 4 + 4) as field}<InputField
                  {field}
                  bind:value={values[field.key]}
                />{/each}
            </div>
          </fieldset>
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
  <div class="result-panel" aria-live="polite" aria-atomic="true">
    <p class="eyebrow">Your result</p>
    {#if output.error}<p class="error" role="alert">
        {output.error}
      </p>{:else if output.result}
      <output class="result-value">{output.result.value}</output>
      <p>{output.result.detail}</p>
      {#if output.result.rows?.length}<div class="result-table">
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
</section>
