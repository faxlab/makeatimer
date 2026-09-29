<script lang="ts">
  import type { Field } from '../lib/types';
  import ZonePicker from './ZonePicker.svelte';
  let {
    field,
    value = $bindable(''),
    prefix = '',
  } = $props<{ field: Field; value: string; prefix?: string }>();
  let id = $derived(`${prefix}${field.key}`);
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
        {id}
        type={field.type || 'text'}
        {value}
        oninput={(e) => {
          value = e.currentTarget.value;
        }}
        min={field.min}
        max={field.max}
        step={field.step || 'any'}
        maxlength="300"
        aria-describedby={field.help ? `${id}-help` : undefined}
      />
    {/if}
    {#if field.help}<small id={`${id}-help`}>{field.help}</small>{/if}
  </div>
{/if}
