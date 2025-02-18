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
Return the response as a code block with no additional explanation.
If no code changes are needed, return the original code block.`;

// Convert fs functions to Promises
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

function generateComment(promptName: string, date?: string): string {
  let comment = `// Generated using ${promptName}`;
  if (date) {
    comment += ` on ${date}`;
  }
  return comment;
}

async function requiresProcessing(
  filePath: string,
  promptName: string
): Promise<boolean> {
  try {
    let fileContent = await readFile(filePath, "utf-8");

    // Check if file already has the generated comment
    const generatedComment = generateComment(promptName);
    if (fileContent.includes(generatedComment)) {
      return false;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
  return true;
}

// Process a single file
async function processFile(
  filePath: string,
  prompt: string,
  promptName: string
) {
  const date = moment().format("YYYY-MM-DD");

  try {
    let fileContent = await readFile(filePath, "utf-8");

    // Check if file already has the generated comment
    const generatedComment = generateComment(promptName, date);
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

interface IParams {
  promptPath: string;
  sourcePath: string;
  includesText: string | undefined;
}

function getParams(): IParams {
  // Simple argument parsing
  let promptPath: string | undefined;
  let sourcePath: string | undefined;
  let includesText: string | undefined;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg.startsWith("--includes=")) {
      // Extract the text after --includes=
      includesText = arg.slice("--includes=".length);
    } else if (!promptPath) {
      promptPath = arg;
    } else if (!sourcePath) {
      sourcePath = arg;
    }
  }

  if (!promptPath || !sourcePath) {
    console.error(
      "Usage: ts-node script.ts <promptPath> <sourcePath> [--includes=text]"
    );
    process.exit(1);
  }

  return { promptPath, sourcePath, includesText };
}

async function getFilePaths(params: IParams): Promise<string[]> {
  const { promptPath, sourcePath, includesText } = params;

  // Check that prompt file exists
  if (!fs.existsSync(promptPath)) {
    console.error(`Prompt file not found: ${promptPath}`);
    process.exit(1);
  }

  // Determine if sourcePath is a directory or file
  let files: string[] = [];
  try {
    const stats = await stat(sourcePath);
    if (stats.isDirectory()) {
      // Grab all matching code files
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

  // If --includes=<text> was provided, filter files to only those containing that text
  if (includesText) {
    const filtered: string[] = [];
    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        if (content.includes(includesText)) {
          filtered.push(file);
        }
      } catch (e) {
        // If a file can't be read or doesn't exist, ignore it
      }
    }
    files = filtered;
  }

  return files;
}

interface IPrompt {
  prompt: string;
  promptName: string;
}

async function fetchPrompt(promptPath: string): Promise<IPrompt> {
  // Read the prompt
  const prompt = await readFile(promptPath, "utf-8");
  const promptName = path.basename(promptPath);
  return { prompt, promptName };
}

// Main function
async function main() {
  const params = getParams();
  const files = await getFilePaths(params);

  // filter the files down to only those that need processing
  const filesToProcess = await Promise.all(
    files.filter((file) => requiresProcessing(file, params.promptPath))
  );

  filesToProcess.forEach((file) => {
    console.log(file);
  });

  // const { prompt, promptName } = await fetchPrompt(params.promptPath);

  // // Process each file
  // for (const file of files) {
  //   await processFile(file, prompt, promptName, date);
  // }
}

// Run the script
main().catch(console.error);
