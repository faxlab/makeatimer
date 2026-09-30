<script lang="ts">
  import type { Values } from '../lib/types';
  import { encodeShare, copyText } from '../lib/share';
  let {
    values,
    text,
    path,
    disabled = false,
    live = false,
  } = $props<{
    values: Values;
    text: string;
    path: string;
    disabled?: boolean;
    live?: boolean;
  }>();
  let status = $state('');
  let showShare = $state(false);
  let shareUrl = $derived(
    showShare ? `${location.origin}${path}${encodeShare(values)}` : '',
  );
  $effect(() => {
    shareUrl;
    status = '';
  });
  async function copy() {
    try {
      await copyText(text);
      status = 'Result copied.';
    } catch (e) {
      status = (e as Error).message;
    }
  }
  async function share() {
    const url = `${location.origin}${path}${encodeShare(values)}`;
    showShare = true;
    try {
      await copyText(url);
      status = live
        ? 'Link copied. Opens as a live countdown; sound stays off.'
        : 'Share link copied. Opening it will not start a timer.';
    } catch {
      status = 'Select and copy the share link below.';
    }
  }
</script>

<div class="actions">
  <button class="quiet" onclick={copy} {disabled}>Copy result</button>
  <button class="quiet" onclick={share} {disabled}
    >Share link <span aria-hidden="true">↗</span></button
  >
</div>
{#if shareUrl}<div class="field share-field">
    <label for={`share-${path.replaceAll('/', '') || 'timer'}`}
      >Share link</label
    ><input
      id={`share-${path.replaceAll('/', '') || 'timer'}`}
      readonly
      value={shareUrl}
      onfocus={(e) => e.currentTarget.select()}
    />
  </div>{/if}
<p class="status" role="status">{status}</p>
