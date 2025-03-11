"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCodeBlock = extractCodeBlock;
// Extract code block from GPT response, e.g.
//
// Here is some code:
// ```typescript
// const x = 1;
// ```
//
// It expects newlines before and after the code block.
function extractCodeBlock(response) {
    const count = response.match(/```[^\n]*\n(.*?)\n```/gs);
    // s is needed to match newlines
    const match = response.match(/```[^\n]*\n(.*?)\n```/s);
    if (!count || count.length !== 1 || match === null || match.length !== 2) {
        throw new Error(`Expected exactly one code block, got ${count ? count.length : 0}`);
    }
    return match[1];
}
