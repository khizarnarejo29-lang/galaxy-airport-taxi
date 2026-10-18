import { describe, expect, it } from "vitest";
import { describeLuggage } from "./luggage";

describe("describeLuggage", () => {
  const none = { large: 0, small: 0 };

  it("names suitcases with hand luggage together", () => {
    expect(describeLuggage(none, "suitcases", true)).toBe("Suitcases and hand luggage");
  });

  it("names a single category as before", () => {
    expect(describeLuggage(none, "suitcases")).toBe("Suitcases");
    expect(describeLuggage(none, "hand_luggage", true)).toBe("Hand luggage");
    expect(describeLuggage(none, "none")).toBe("None");
  });
});
