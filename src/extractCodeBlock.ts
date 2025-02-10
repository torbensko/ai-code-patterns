// Extract code block from GPT response, e.g.
//
// Here is some code:
// ```typescript
// const x = 1;
// ```
//
// It expects newlines before and after the code block.
export function extractCodeBlock(response: string): string | null {
  const count = response.match(/```[^\n]*\n(.*?)\n```/g);
  const match = response.match(/```[^\n]*\n(.*?)\n```/);

  if (!count || count.length !== 1) {
    throw new Error(
      `Expected exactly one code block, got ${count ? count.length : 0}`
    );
  }

  return match ? match[1] : null;
}
