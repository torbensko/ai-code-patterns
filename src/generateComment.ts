export function generateComment(promptFile: string, date?: string): string {
  let promptName = promptFile.split(".")[0];
  let comment = `// performed \"${promptName}\" review`;
  if (date) {
    comment += ` on ${date}`;
  }
  return comment;
}
