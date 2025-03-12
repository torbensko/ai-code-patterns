import { generateComment } from "./generateComment";

describe("generateComment", () => {
  it("should generate a comment without date", () => {
    const result = generateComment("example.txt");
    expect(result).toBe('// performed "example" review');
  });

  it("should generate a comment with date", () => {
    const result = generateComment("example.txt", "2023-10-01");
    expect(result).toBe('// performed "example" review on 2023-10-01');
  });

  it("should handle files without extensions", () => {
    const result = generateComment("example");
    expect(result).toBe('// performed "example" review');
  });

  it("should handle files with multiple dots", () => {
    const result = generateComment("example.test.txt");
    expect(result).toBe('// performed "example" review');
  });
});
