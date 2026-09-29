<script lang="ts">
  import { onMount } from 'svelte';
  import { tools, categories, toolPath } from '../lib/tools';
  let search = $state('');
  let category = $state('All');
  let favourites = $state<string[]>([]);
  let onlyFavourites = $state(false);
  let results = $derived(
    tools.filter(
      (t) =>
        (category === 'All' || category === t.category) &&
        (!onlyFavourites || favourites.includes(t.id)) &&
        `${t.name} ${t.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
  );
  onMount(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('makeatimer:favourites') || '[]',
      );
      favourites = Array.isArray(stored)
        ? stored.filter((id) => tools.some((t) => t.id === id))
        : [];
    } catch {
      /* optional */
    }
  });
  function favourite(id: string) {
    favourites = favourites.includes(id)
      ? favourites.filter((x) => x !== id)
      : [...favourites, id];
    try {
      localStorage.setItem('makeatimer:favourites', JSON.stringify(favourites));
    } catch {
      /* optional */
    }
  }
</script>

<div class="directory-controls">
  <div class="field">
    <label for="tool-search">Find a tool</label><input
      id="tool-search"
      type="search"
      bind:value={search}
      placeholder="Try “work hours” or “frames”"
    />
  </div>
  <label class="checkbox"
    ><input type="checkbox" bind:checked={onlyFavourites} /> Favourites only</label
  >
</div>
<div class="filter-tabs" aria-label="Tool category">
  {#each ['All', ...categories] as c}<button
      class:chosen={category === c}
      aria-pressed={category === c}
      onclick={() => {
        category = c;
      }}>{c}</button
    >{/each}
</div>
<p class="muted" aria-live="polite">{results.length} tools</p>
<div class="tool-grid">
  {#each results as tool}<article class="tool-tile">
      <span class="eyebrow">{tool.category}</span><button
        class="favourite"
        aria-label={`${favourites.includes(tool.id) ? 'Remove' : 'Add'} ${tool.name} ${favourites.includes(tool.id) ? 'from' : 'to'} favourites`}
        aria-pressed={favourites.includes(tool.id)}
        onclick={() => favourite(tool.id)}
        >{favourites.includes(tool.id) ? '★' : '☆'}</button
      >
      <h2>
        <a href={toolPath(tool.id)}
          >{tool.name}<span aria-hidden="true">↗</span></a
        >
      </h2>
      <p>{tool.description}</p>
    </article>{/each}
</div>
{#if !results.length}<p class="notice">
    No tools match. Try another search or category.
  </p>{/if}
