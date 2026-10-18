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

  it("gives the number of each kind when known", () => {
    expect(describeLuggage(none, "suitcases", true, { suitcases: 2, handLuggage: 1 })).toBe("2 suitcases and 1 hand luggage bag");
    expect(describeLuggage(none, "hand_luggage", false, { handLuggage: 3 })).toBe("3 hand luggage bags");
    expect(describeLuggage(none, "suitcases", false, { suitcases: 1 })).toBe("1 suitcase");
  });
});
