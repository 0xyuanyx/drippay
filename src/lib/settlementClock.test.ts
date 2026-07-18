import { describe, expect, it } from "vitest";

import { formatElapsed, formatPointsPerSecond, formatProgress } from "./settlementClock";

describe("settlement clock copy", () => {
  it("keeps seconds visible from the first moment", () => {
    expect(formatElapsed(5n)).toBe("5초");
    expect(formatElapsed(3_665n)).toBe("1시간 1분 5초");
  });

  it("does not round short progress down to an unchanging 0.0%", () => {
    expect(formatProgress(0.0002)).toBe("0.0002");
    expect(formatPointsPerSecond(8_000n * 10n ** 18n, 30 * 86_400)).toBe("0.0031");
  });
});
