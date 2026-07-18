export function formatElapsed(seconds: bigint): string {
  const safeSeconds = seconds < 0n ? 0n : seconds;
  const days = safeSeconds / 86_400n;
  const hours = (safeSeconds % 86_400n) / 3_600n;
  const minutes = (safeSeconds % 3_600n) / 60n;
  const remainingSeconds = safeSeconds % 60n;
  const parts = [
    days > 0n ? `${days.toString()}일` : "",
    hours > 0n || days > 0n ? `${hours.toString()}시간` : "",
    minutes > 0n || hours > 0n || days > 0n ? `${minutes.toString()}분` : "",
    `${remainingSeconds.toString()}초`,
  ].filter(Boolean);
  return parts.join(" ");
}

export function formatProgress(progress: number): string {
  return progress < 1 ? progress.toFixed(4) : progress.toFixed(1);
}

export function clampElapsed(startedAt: bigint, endsAt: bigint, observedNow: bigint): bigint {
  const effectiveNow = observedNow < startedAt ? startedAt : observedNow > endsAt ? endsAt : observedNow;
  return effectiveNow - startedAt;
}

export function formatPointsPerSecond(amount: bigint, durationSeconds: number): string {
  if (durationSeconds <= 0) return "0";
  const pointAmount = Number(amount / 10n ** 18n);
  return (pointAmount / durationSeconds).toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

export function formatAccruedPoints(amount: bigint, durationSeconds: number, elapsedSeconds: bigint): string {
  if (durationSeconds <= 0) return "0";
  const duration = BigInt(durationSeconds);
  const safeElapsed = elapsedSeconds < 0n ? 0n : elapsedSeconds > duration ? duration : elapsedSeconds;
  const accrued = amount * safeElapsed / duration;
  const pointAmount = Number(accrued) / 1e18;
  if (pointAmount >= 1) return pointAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return pointAmount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function secondsPerPoint(amount: bigint, durationSeconds: number): bigint {
  const pointAmount = amount / 10n ** 18n;
  if (pointAmount <= 0n) return 0n;
  return BigInt(Math.round(durationSeconds / Number(pointAmount)));
}
