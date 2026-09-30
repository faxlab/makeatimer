import { adjustValue, type Adjustment } from './adjust-value';

export function dragValue(node: HTMLInputElement, initial?: Adjustment) {
  let options = initial;
  let pointer: number | null = null;
  let originY = 0;
  let originX = 0;
  let anchorY = 0;
  let anchorValue = '';
  let originalValue = '';
  let fine = false;
  let coarse = false;
  let dragging = false;
  let suppressClick = false;
  const originalTitle = node.title;

  function describe() {
    node.classList.toggle('scrub-value', !!options);
    node.title = options
      ? 'Drag up/down to adjust. Shift for fine control; Alt for larger steps. Escape cancels.'
      : originalTitle;
  }
  function write(value: string) {
    if (node.value === value) return;
    node.value = value;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function finish(cancel = false) {
    if (dragging && cancel) write(originalValue);
    suppressClick = dragging;
    if (pointer !== null && node.hasPointerCapture(pointer))
      node.releasePointerCapture(pointer);
    pointer = null;
    dragging = false;
    node.classList.remove('scrubbing');
    document.body.classList.remove('value-dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancelled);
    window.removeEventListener('keydown', escape);
  }
  function down(event: PointerEvent) {
    suppressClick = false;
    // Touch keeps its normal scrolling and native field editing behaviour.
    if (
      !options ||
      event.pointerType === 'touch' ||
      !event.isPrimary ||
      event.button !== 0 ||
      node.disabled ||
      node.readOnly
    )
      return;
    // Preserve native picker/spinner targets at the right edge.
    if (
      node.type !== 'text' &&
      event.clientX > node.getBoundingClientRect().right - 24
    )
      return;
    if (adjustValue(node.value, 0, options) === null) return;
    pointer = event.pointerId;
    originY = anchorY = event.clientY;
    originX = event.clientX;
    anchorValue = originalValue = node.value;
    fine = event.shiftKey;
    coarse = event.altKey;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelled);
    window.addEventListener('keydown', escape);
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointer || !options) return;
    if (!dragging) {
      const vertical = Math.abs(event.clientY - originY);
      if (
        Math.abs(event.clientX - originX) > vertical &&
        Math.abs(event.clientX - originX) > 6
      ) {
        finish();
        return;
      }
      if (vertical < 6) return;
      dragging = true;
      node.setPointerCapture(event.pointerId);
      node.focus({ preventScroll: true });
      node.classList.add('scrubbing');
      document.body.classList.add('value-dragging');
    }
    event.preventDefault();
    if (fine !== event.shiftKey || coarse !== event.altKey) {
      anchorValue = node.value;
      anchorY = event.clientY;
      fine = event.shiftKey;
      coarse = event.altKey;
    }
    const pixels =
      fine && (options.integer || options.kind === 'date') ? 32 : 8;
    const distance = anchorY - event.clientY;
    const steps =
      Math.sign(distance) *
      Math.round(Math.abs(distance) / pixels) *
      (coarse ? 10 : 1);
    const next = adjustValue(anchorValue, steps, options, fine);
    if (next !== null) {
      write(next);
      // Discard overshoot at a limit so reversing direction responds at once.
      if (
        steps &&
        adjustValue(next, Math.sign(steps), options, fine) === next
      ) {
        anchorValue = next;
        anchorY = event.clientY;
      }
    }
  }
  function up(event: PointerEvent) {
    if (event.pointerId === pointer) finish();
  }
  function cancelled(event: PointerEvent) {
    if (event.pointerId === pointer) finish(true);
  }
  function escape(event: KeyboardEvent) {
    if (event.key === 'Escape' && pointer !== null) {
      event.preventDefault();
      finish(true);
    }
  }
  function click(event: MouseEvent) {
    if (suppressClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }
  }
  function key(event: KeyboardEvent) {
    if (
      !options ||
      node.disabled ||
      node.readOnly ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    // Native number/date/time fields already expose keyboard adjustment.
    if (
      options.kind !== 'auto' ||
      !['ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    const next = adjustValue(
      node.value,
      event.key === 'ArrowUp' ? 1 : -1,
      options,
      event.shiftKey,
    );
    if (next !== null) {
      event.preventDefault();
      write(next);
    }
  }
  describe();
  node.addEventListener('pointerdown', down);
  node.addEventListener('click', click, true);
  node.addEventListener('keydown', key);
  return {
    update(next?: Adjustment) {
      options = next;
      describe();
    },
    destroy() {
      finish();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('click', click, true);
      node.removeEventListener('keydown', key);
      node.classList.remove('scrub-value');
      node.title = originalTitle;
    },
  };
}
