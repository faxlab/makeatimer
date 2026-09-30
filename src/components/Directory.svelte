<script lang="ts">
  import { onMount } from 'svelte';
  import { tools, toolPath } from '../lib/tools';
  import { families, familyStyle, getFamily } from '../lib/families';
  import type { ToolFamilyId } from '../lib/types';
  let search = $state('');
  let family = $state<ToolFamilyId | 'all'>('all');
  let favourites = $state<string[]>([]);
  let onlyFavourites = $state(false);
  let results = $derived(
    tools.filter(
      (tool) =>
        (family === 'all' || family === tool.family) &&
        (!onlyFavourites || favourites.includes(tool.id)) &&
        (tool.name + ' ' + tool.description + ' ' + getFamily(tool.family).name)
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    ),
  );
  onMount(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('makeatimer:favourites') || '[]',
      );
      favourites = Array.isArray(stored)
        ? stored.filter((id) => tools.some((tool) => tool.id === id))
        : [];
    } catch {
      /* Favourites are optional. */
    }
    const readHash = () => {
      if (location.hash === '#favourites') onlyFavourites = true;
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  });
  function favourite(id: string) {
    favourites = favourites.includes(id)
      ? favourites.filter((item) => item !== id)
      : [...favourites, id];
    try {
      localStorage.setItem('makeatimer:favourites', JSON.stringify(favourites));
    } catch {
      /* optional */
    }
  }
  function clear() {
    search = '';
    family = 'all';
    onlyFavourites = false;
  }
</script>

<div class="directory-controls">
  <div class="field">
    <label for="tool-search">Find a tool</label>
    <input
      id="tool-search"
      type="search"
      bind:value={search}
      placeholder="Search tools, e.g. work hours or frames"
    />
  </div>
  <label class="checkbox"
    ><input type="checkbox" bind:checked={onlyFavourites} /> Favourites only</label
  >
</div>
<div class="filter-tabs" aria-label="Tool category">
  <button
    class:chosen={family === 'all'}
    aria-pressed={family === 'all'}
    onclick={() => (family = 'all')}>All</button
  >
  {#each families as item}
    <button
      class="family-scope"
      style={familyStyle(item.id)}
      class:chosen={family === item.id}
      aria-pressed={family === item.id}
      onclick={() => (family = item.id)}
      ><span class="family-mark" aria-hidden="true"></span>{item.name}</button
    >
  {/each}
</div>
<div class="directory-summary">
  <p class="muted" aria-live="polite">
    {results.length}
    {results.length === 1 ? 'tool' : 'tools'}
  </p>
  {#if search || family !== 'all' || onlyFavourites}<button
      class="quiet"
      onclick={clear}>Clear filters</button
    >{/if}
</div>
<div class="directory-grid">
  {#each families as item}
    {@const group = results.filter((tool) => tool.family === item.id)}
    {#if group.length}
      <section
        class="directory-family family-scope"
        style={familyStyle(item.id)}
        aria-labelledby={'family-' + item.id}
      >
        <h2 id={'family-' + item.id}>
          <span class="family-mark" aria-hidden="true"></span>{item.name}<span
            class="nav-count">{group.length}</span
          >
        </h2>
        <ul>
          {#each group as tool}
            <li class="tool-tile">
              <div>
                <h3>
                  <a href={toolPath(tool.id)}
                    >{tool.name}<span aria-hidden="true">→</span></a
                  >
                </h3>
                <p>{tool.description}</p>
              </div>
              <button
                class="favourite"
                aria-label={(favourites.includes(tool.id)
                  ? 'Remove '
                  : 'Add ') +
                  tool.name +
                  (favourites.includes(tool.id) ? ' from' : ' to') +
                  ' favourites'}
                aria-pressed={favourites.includes(tool.id)}
                onclick={() => favourite(tool.id)}
                >{favourites.includes(tool.id) ? '★' : '☆'}</button
              >
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
</div>
{#if !results.length}
  <p class="notice">
    {onlyFavourites && !favourites.length
      ? 'No favourites yet. Use the star beside a tool to save it here.'
      : 'No tools match. Try another search or category.'}
  </p>
{/if}
