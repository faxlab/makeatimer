export type AdEnvironment = {
  loadScript: () => void;
  fill: (id: string) => void;
  clear: () => void;
  reload: () => void;
};
/** The certified CMP owns consent. This controller receives its advertising-permitted state. */
export function adController(enabled: boolean, env: AdEnvironment) {
  let permitted = false;
  let active = false;
  let loaded = false;
  const filled = new Set<string>();
  function update() {
    if (!enabled || !permitted || active) return;
    if (!loaded) {
      env.loadScript();
      loaded = true;
    }
  }
  return {
    consent(allow: boolean) {
      const revoked = permitted && !allow;
      permitted = allow;
      if (revoked) {
        env.clear();
        if (loaded) env.reload();
      } else update();
    },
    timing(isActive: boolean) {
      active = isActive;
      update();
    },
    visible(id: string) {
      if (!enabled || !permitted || active || filled.has(id)) return;
      update();
      filled.add(id);
      env.fill(id);
    },
  };
}
