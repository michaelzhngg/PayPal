import { describe, it, expect } from "vitest";
import { pushToast, removeToast, type ToastItem } from "./queue";

const t = (id: number): ToastItem => ({ id, title: `Toast ${id}`, tone: "info" });

describe("toast queue", () => {
  it("keeps the newest three and drops the oldest", () => {
    let q: ToastItem[] = [];
    for (const id of [1, 2, 3, 4]) q = pushToast(q, t(id));
    expect(q.map((x) => x.id)).toEqual([2, 3, 4]);
  });

  it("removes a toast by id and leaves the rest in order", () => {
    expect(removeToast([t(1), t(2), t(3)], 2).map((x) => x.id)).toEqual([1, 3]);
  });
});
