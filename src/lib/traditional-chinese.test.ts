import { expect, test } from "vitest";
import { toTaiwanTraditional } from "./traditional-chinese";

test("converts Simplified Chinese to Taiwan Traditional Chinese", () => {
  expect(toTaiwanTraditional("交付时间和两个续约客户")).toBe("交付時間和兩個續約客戶");
  expect(toTaiwanTraditional("客户投诉下降百分之三十")).toContain("客戶投訴下降百分之三十");
});

test("leaves already Traditional Chinese intact", () => {
  expect(toTaiwanTraditional("我讓客訴下降百分之三十")).toBe("我讓客訴下降百分之三十");
});
