export type LatestRequestGuard<Key> = {
  begin: (key: Key) => { isCurrent: () => boolean };
  invalidate: () => void;
};

export function createLatestRequestGuard<Key>(
  getCurrentKey: () => Key | undefined,
  keysEqual: (left: Key, right: Key) => boolean = Object.is,
): LatestRequestGuard<Key> {
  let latestSequence = 0;

  return {
    begin(key) {
      const sequence = ++latestSequence;

      return {
        isCurrent() {
          const currentKey = getCurrentKey();
          return (
            sequence === latestSequence &&
            currentKey !== undefined &&
            keysEqual(currentKey, key)
          );
        },
      };
    },
    invalidate() {
      latestSequence += 1;
    },
  };
}
