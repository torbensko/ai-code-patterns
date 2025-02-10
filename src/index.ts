#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { glob } from "glob";
import OpenAI from "openai";
import dotenv from "dotenv";
import moment from "moment";
import { extractCodeBlock } from "./extractCodeBlock";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required.");
  process.exit(1);
}
if (!process.env.OPENAI_GPT_MODEL) {
  console.error("OPENAI_GPT_MODEL is required.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_GPT_MODEL ?? "gpt-4o-mini";

const sharedPrompt = `Please maintain all logic, comments, imports.
Return the response as a code block with no additional explanation.`;

// Convert fs functions to Promises
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

// Process a single file
async function processFile(
  filePath: string,
  prompt: string,
  promptName: string,
  date: string
) {
  try {
    let fileContent = await readFile(filePath, "utf-8");

    // Check if file already has the generated comment
    const generatedComment = `// Generated using ${promptName} on ${date}`;
    if (fileContent.includes(generatedComment)) {
      console.log(`Skipping ${filePath} (already processed with this prompt)`);
      return;
    }

    const extension = path.extname(filePath).replace(".", "");

    // Concatenate prompt and file content
    const input = `${prompt}\n\n${sharedPrompt}\n\n\`\`\`${extension}\n${fileContent}\`\`\`\n`;

    console.log(`Processing: ${filePath}...`);
    // DEBUG:
    //console.log(input);

    // Send to OpenAI
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: input }],
    });

    const response = completion.choices[0].message?.content ?? "";
    //console.log(response);

    // will throw if it doesn't include a single code block
    const extractedCode = extractCodeBlock(response);

    // Write the result back with a comment
    const updatedContent = `${generatedComment}\n\n${extractedCode}`;
    await writeFile(filePath, updatedContent, "utf-8");

    console.log(`Updated: ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Main function
async function main() {
  const promptPath = process.argv[2];
  const sourcePath = process.argv[3];

  if (!promptPath || !sourcePath) {
    console.error("Usage: ts-node script.ts <promptPath> <sourcePath>");
    process.exit(1);
  }

  // Read the prompt file
  if (!fs.existsSync(promptPath)) {
    console.error(`Prompt file not found: ${promptPath}`);
    process.exit(1);
  }
  const prompt = await readFile(promptPath, "utf-8");
  const promptName = path.basename(promptPath);
  const date = moment().format("YYYY-MM-DD");

  // Determine if sourcePath is a directory or file
  let files: string[] = [];
  try {
    const stats = await stat(sourcePath);
    if (stats.isDirectory()) {
      files = await glob(
        `${sourcePath}/**/*.{ts,js,py,java,cpp,swift,kt,go,rb}`,
        { nodir: true }
      );
    } else {
      files = [sourcePath];
    }
  } catch (err) {
    console.error(`Invalid path: ${sourcePath}`);
    process.exit(1);
  }

  // Process each file
  for (const file of files) {
    await processFile(file, prompt, promptName, date);
  }
}

// Run the script
main().catch(console.error);
