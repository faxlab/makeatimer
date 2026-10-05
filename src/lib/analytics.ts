export const ANALYTICS_STORAGE_KEY = 'makeatimer:statistics:v1';
export const ANALYTICS_LIFETIME = 180 * 24 * 60 * 60 * 1000;
export type AnalyticsChoice = 'unset' | 'allowed' | 'denied';
export type AnalyticsRecord = {
  version: 1;
  choice: Exclude<AnalyticsChoice, 'unset'>;
  savedAt: number;
};
export type AnalyticsState = {
  choice: AnalyticsChoice;
  savedAt: number | null;
  script: 'idle' | 'loading' | 'loaded' | 'blocked';
  storageError: boolean;
};
export function readAnalyticsChoice(
  raw: string | null,
  now: number,
): AnalyticsRecord | null {
  try {
    const value = JSON.parse(raw || 'null');
    if (
      value?.version !== 1 ||
      !['allowed', 'denied'].includes(value.choice) ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt < 0 ||
      value.savedAt > now ||
      now - value.savedAt >= ANALYTICS_LIFETIME
    )
      return null;
    return { version: 1, choice: value.choice, savedAt: value.savedAt };
  } catch {
    return null;
  }
}
type AnalyticsEnvironment = {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  now: () => number;
  load: () => Promise<void>;
  reload: () => void;
  changed: (state: AnalyticsState) => void;
};
/** Statistics permission is independent of the certified advertising CMP. */
export function analyticsController(
  enabled: boolean,
  env: AnalyticsEnvironment,
) {
  let state: AnalyticsState = {
    choice: 'unset',
    savedAt: null,
    script: 'idle',
    storageError: false,
  };
  let attempted = false;
  let reloading = false;
  const emit = () => env.changed({ ...state });
  function apply(record: AnalyticsRecord | null, storageError = false) {
    state = {
      ...state,
      choice: record?.choice || 'unset',
      savedAt: record?.savedAt ?? null,
      storageError,
    };
    if (attempted && state.choice !== 'allowed') {
      if (!reloading) {
        reloading = true;
        env.reload();
      }
    } else if (
      enabled &&
      state.choice === 'allowed' &&
      !attempted &&
      !storageError
    ) {
      attempted = true;
      state.script = 'loading';
      Promise.resolve()
        .then(() => {
          if (state.choice === 'allowed' && !reloading) return env.load();
        })
        .then(() => {
          if (state.choice === 'allowed' && !reloading) {
            state.script = 'loaded';
            emit();
          }
        })
        .catch(() => {
          if (!reloading) {
            state.script = 'blocked';
            emit();
          }
        });
    }
    emit();
  }
  return {
    state: () => ({ ...state }),
    refresh() {
      if (!enabled) {
        emit();
        return;
      }
      try {
        apply(
          readAnalyticsChoice(
            env.storage.getItem(ANALYTICS_STORAGE_KEY),
            env.now(),
          ),
        );
      } catch {
        apply(null, true);
      }
    },
    choose(choice: Exclude<AnalyticsChoice, 'unset'>) {
      if (!enabled) return false;
      const record: AnalyticsRecord = {
        version: 1,
        choice,
        savedAt: env.now(),
      };
      try {
        const raw = JSON.stringify(record);
        env.storage.setItem(ANALYTICS_STORAGE_KEY, raw);
        if (env.storage.getItem(ANALYTICS_STORAGE_KEY) !== raw)
          throw new Error('Choice was not saved');
        apply(record);
        return true;
      } catch {
        apply(null, true);
        return false;
      }
    },
  };
}
