export function generateComment(promptName: string, date?: string): string {
  let comment = `// performed \"${promptName}\" review`;
  if (date) {
    comment += ` on ${date}`;
  }
  return comment;
}
