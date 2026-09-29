<script lang="ts">
  import { zoneOptions } from '../lib/zone-options';
  let {
    id,
    label,
    value = $bindable('UTC'),
    optional = false,
  } = $props<{
    id: string;
    label: string;
    value: string;
    optional?: boolean;
  }>();
  let search = $state('');
  const options = zoneOptions();
  let filtered = $derived(
    options.filter(([v, label]) =>
      `${v} ${label}`.toLowerCase().includes(search.toLowerCase()),
    ),
  );
</script>

<div class="field zone-field">
  <label for={id}>{label}</label>
  <input
    type="search"
    aria-label={`Search ${label.toLowerCase()}`}
    placeholder="Search city or UTC offset"
    bind:value={search}
  />
  <select {id} bind:value>
    {#if optional}<option value="">Not included</option>{/if}
    {#if value && !filtered.some(([z]) => z === value)}<option {value}
        >{options.find(([z]) => z === value)?.[1] || value}</option
      >{/if}
    {#each filtered as [zone, name]}<option value={zone}>{name}</option>{/each}
  </select>
  {#if search && !filtered.length}<small
      >No matching zones. Try a city name such as London.</small
    >{/if}
</div>
