<script lang="ts">
  import type { Field } from '../lib/types';
  import ZonePicker from './ZonePicker.svelte';
  import { dragValue } from '../lib/drag-value';
  import { adjustValue } from '../lib/adjust-value';
  let {
    field,
    value = $bindable(''),
    prefix = '',
  } = $props<{ field: Field; value: string; prefix?: string }>();
  let id = $derived(`${prefix}${field.key}`);
  function adjustPresetField(event: KeyboardEvent) {
    if (
      !field.presets ||
      !field.adjustment ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !['ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    const next = adjustValue(
      value,
      event.key === 'ArrowUp' ? 1 : -1,
      field.adjustment,
      event.shiftKey,
    );
    if (next !== null) {
      event.preventDefault();
      value = next;
    }
  }
</script>

{#if field.type === 'zone'}
  <ZonePicker
    {id}
    label={field.label}
    bind:value
    optional={field.default === ''}
  />
{:else}
  <div class:wide={field.type === 'textarea'} class="field">
    <label for={id}>{field.label}</label>
    {#if field.type === 'select'}
      <select
        {id}
        bind:value
        aria-describedby={field.help ? `${id}-help` : undefined}
        >{#each field.options || [] as [val, label]}<option value={val}
            >{label}</option
          >{/each}</select
      >
    {:else if field.type === 'textarea'}
      <textarea
        {id}
        rows="4"
        bind:value
        maxlength="11000"
        spellcheck="false"
        aria-describedby={field.help ? `${id}-help` : undefined}></textarea>
    {:else}
      <input
        use:dragValue={field.adjustment}
        {id}
        type={field.type || 'text'}
        {value}
        oninput={(e) => {
          value = e.currentTarget.value;
        }}
        onkeydown={adjustPresetField}
        min={field.min}
        max={field.max}
        step={field.step || 'any'}
        maxlength="300"
        aria-describedby={field.help ? `${id}-help` : undefined}
      />
    {/if}
    {#if field.help}<small id={`${id}-help`}>{field.help}</small>{/if}
    {#if field.presets?.length}
      <div
        class="field-presets"
        role="group"
        aria-label={`${field.label} presets`}
      >
        {#each field.presets as [preset, label]}
          <button
            type="button"
            class="secondary"
            aria-pressed={value.trim() !== '' &&
              Number(value) === Number(preset)}
            onclick={() => {
              value = preset;
            }}>{label}</button
          >
        {/each}
      </div>
    {/if}
  </div>
{/if}
