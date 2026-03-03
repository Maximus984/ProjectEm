function canAcquireLock(current: string | null) {
  return current === null;
}

describe("simultaneous session rejection", () => {
  it("rejects start when lock already exists", () => {
    expect(canAcquireLock("1")).toBe(false);
  });

  it("allows start when lock does not exist", () => {
    expect(canAcquireLock(null)).toBe(true);
  });
});
