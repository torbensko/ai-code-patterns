import { extractCodeBlock } from "./extractCodeBlock";

test("extracts code block from a string", () => {
  const input = "Here is some text\n```typescript\ncode block\n```\nMore text";
  const expected = "code block";
  expect(extractCodeBlock(input)).toBe(expected);
});

test("extracts code block from a string", () => {
  const input = `\`\`\`swift
//
//  SplitButton.swift
//  Workouts
//
//  Created by Torben Sko on 9/12/2024.
//

import SwiftUI

/// @Deprecated Created as an experiment for BetweenExercisesButtonView
struct SplitButton: View {
    let leftTitle: String
    ...
}

#Preview {
    SplitButton_Preview()
}
\`\`\``;
  expect(extractCodeBlock(input).length).toBeGreaterThan(0);
});

test("throws if missing a code block", () => {
  const input = "Just some text without code";
  expect(() => extractCodeBlock(input)).toThrow();
});

test("throws error if there isn't a single code block", () => {
  const input =
    "Here is some text\n```typescript\nfirst block\n```\nMore text\n```typescript\nsecond block\n```";

  expect(() => extractCodeBlock(input)).toThrow();
});
