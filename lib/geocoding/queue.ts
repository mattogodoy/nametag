// The public Nominatim usage policy caps clients at 1 request per second.
// This in-process queue serializes every geocoder call in this Node process.
// With multiple app instances the worst case is N requests per second, which
// is acceptable at Nametag's scale; self-hosters can point GEOCODER_URL at
// their own instance to remove the shared-provider concern entirely.
const MIN_INTERVAL_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastStartAt = 0;
let chain: Promise<void> = Promise.resolve();

export function enqueueGeocodeRequest<T>(task: () => Promise<T>): Promise<T> {
  const result = chain.then(async () => {
    const waitMs = lastStartAt + MIN_INTERVAL_MS - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastStartAt = Date.now();
    return task();
  });
  // The chain itself must never reject, or one failure would poison the queue.
  chain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export function resetGeocodeQueueForTests(): void {
  lastStartAt = 0;
  chain = Promise.resolve();
}
