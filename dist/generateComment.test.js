"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generateComment_1 = require("./generateComment");
describe("generateComment", () => {
    it("should generate a comment without date", () => {
        const result = (0, generateComment_1.generateComment)("example");
        expect(result).toBe('// performed "example" review');
    });
    it("should generate a comment with date", () => {
        const result = (0, generateComment_1.generateComment)("example", "2023-10-01");
        expect(result).toBe('// performed "example" review on 2023-10-01');
    });
});
