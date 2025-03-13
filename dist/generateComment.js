"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateComment = generateComment;
function generateComment(promptName, date) {
    let comment = `// performed \"${promptName}\" review`;
    if (date) {
        comment += ` on ${date}`;
    }
    return comment;
}
