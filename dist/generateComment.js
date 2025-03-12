"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateComment = generateComment;
function generateComment(promptFile, date) {
    let promptName = promptFile.split(".")[0];
    let comment = `// performed \"${promptName}\" review`;
    if (date) {
        comment += ` on ${date}`;
    }
    return comment;
}
