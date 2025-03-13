#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const glob_1 = require("glob");
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const moment_1 = __importDefault(require("moment"));
const extractCodeBlock_1 = require("./extractCodeBlock");
const generateComment_1 = require("./generateComment");
dotenv_1.default.config();
if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required.");
    process.exit(1);
}
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_GPT_MODEL ?? "gpt-4o-mini";
const sharedPrompt = `Please maintain all logic, comments, imports.
Return the response as a code block with no additional explanation.
If no code changes are needed, return the original code block.`;
// Convert fs functions to Promises
const readFile = (0, util_1.promisify)(fs_1.default.readFile);
const writeFile = (0, util_1.promisify)(fs_1.default.writeFile);
const stat = (0, util_1.promisify)(fs_1.default.stat);
async function requiresProcessing(filePath, promptName) {
    let fileContent = await readFile(filePath, "utf-8");
    // Check if file already has the generated comment
    const generatedComment = (0, generateComment_1.generateComment)(promptName);
    if (fileContent.includes(generatedComment)) {
        return false;
    }
    return true;
}
// Process a single file
async function processFile(filePath, prompt, promptName, gptModel) {
    const date = (0, moment_1.default)().format("YYYY-MM-DD");
    try {
        let fileContent = await readFile(filePath, "utf-8");
        // Check if file already has the generated comment
        const generatedComment = (0, generateComment_1.generateComment)(promptName, date);
        if (fileContent.includes(generatedComment)) {
            console.log(`Skipping ${filePath} (already processed with this prompt)`);
            return;
        }
        const extension = path_1.default.extname(filePath).replace(".", "");
        // Concatenate prompt and file content
        const input = `${prompt}\n\n${sharedPrompt}\n\n\`\`\`${extension}\n${fileContent}\`\`\`\n`;
        console.log(`🔄 Processing: ${filePath}...`);
        // DEBUG:
        //console.log(input);
        // Send to OpenAI
        const completion = await openai.chat.completions.create({
            model: gptModel,
            messages: [{ role: "user", content: input }],
        });
        const response = completion.choices[0].message?.content ?? "";
        //console.log(response);
        // will throw if it doesn't include a single code block
        const extractedCode = (0, extractCodeBlock_1.extractCodeBlock)(response);
        // Write the result back with a comment
        const updatedContent = `${generatedComment}\n${extractedCode}`;
        await writeFile(filePath, updatedContent, "utf-8");
        console.log(`✅ Finished`);
    }
    catch (error) {
        console.error(`❌ Error:`, error);
    }
}
function getParams() {
    let promptPath;
    let promptName;
    let sourcePath;
    let includesText;
    let gptModel;
    let extensions;
    let dryRun = false;
    gptModel = process.env.OPENAI_GPT_MODEL;
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === "--dry") {
            dryRun = true;
        }
        else if (arg.startsWith("--name=")) {
            promptName = arg.slice("--name=".length);
        }
        else if (arg.startsWith("--model=")) {
            gptModel = arg.slice("--model=".length);
        }
        else if (arg.startsWith("--includes=")) {
            includesText = arg.slice("--includes=".length);
        }
        else if (arg.startsWith("--ext=")) {
            extensions = arg
                .slice("--ext=".length)
                .split(",")
                .map((ext) => ext.trim())
                .filter(Boolean);
        }
        else if (arg.startsWith("--")) {
            console.error(`Unknown option: ${arg}`);
            process.exit(1);
        }
        else if (!promptPath) {
            promptPath = arg;
            // get the prompt name from the file name if not provided
            if (!promptName) {
                // strips the extension and an optional ".review" suffix
                promptName = path_1.default.basename(promptPath).replace(".review", "");
            }
        }
        else if (!sourcePath) {
            sourcePath = arg;
        }
    }
    if (!gptModel) {
        console.error("Please set OPENAI_GPT_MODEL or use --model=<model>");
        process.exit(1);
    }
    if (!promptPath || !sourcePath || !promptName) {
        console.error("Usage: ai-code-patterns [--includes=text] [--ext=ts,js,...] [--dry] [--name=promptName] [--model=gpt-4o] <promptPath> <sourcePath>");
        process.exit(1);
    }
    return {
        promptPath,
        gptModel,
        promptName,
        sourcePath,
        includesText,
        extensions,
        dryRun,
    };
}
async function getFilePaths(params) {
    const { promptPath, sourcePath, includesText, extensions } = params;
    // Check that prompt file exists
    if (!fs_1.default.existsSync(promptPath)) {
        console.error(`Prompt file not found: ${promptPath}`);
        process.exit(1);
    }
    // Determine if sourcePath is a directory or file
    let files = [];
    try {
        const stats = await stat(sourcePath);
        if (stats.isDirectory()) {
            // If the user provided custom extensions, use them. Otherwise, use the default set.
            const defaultExtensions = [
                "ts",
                "js",
                "py",
                "java",
                "cpp",
                "swift",
                "kt",
                "go",
                "rb",
            ];
            const extsToUse = extensions && extensions.length > 0 ? extensions : defaultExtensions;
            // Build a glob pattern like: ./src/**/*.{ts,js,py,...}
            const fileExtensions = extsToUse.length > 1 ? `{${extsToUse.join(",")}}` : extsToUse[0];
            const globPattern = `${sourcePath}/**/*.${fileExtensions}`;
            files = await (0, glob_1.glob)(globPattern, { nodir: true });
        }
        else {
            // Single file provided
            files = [sourcePath];
        }
    }
    catch (err) {
        console.error(`Invalid path: ${sourcePath}`);
        process.exit(1);
    }
    // If --includes=<text> was provided, filter files to only those containing that text
    if (includesText) {
        const filtered = [];
        for (const file of files) {
            try {
                const content = await readFile(file, "utf-8");
                if (content.includes(includesText)) {
                    filtered.push(file);
                }
            }
            catch (e) {
                // If a file can't be read or doesn't exist, ignore it
            }
        }
        files = filtered;
    }
    return files;
}
// Main function
async function main() {
    const params = getParams();
    const { promptName, gptModel } = params;
    const files = await getFilePaths(params);
    const prompt = await readFile(params.promptPath, "utf-8");
    // Only keep files that require processing
    const filesToProcess = [];
    const filesAlreadyProcessed = [];
    for (const file of files) {
        const needed = await requiresProcessing(file, promptName);
        if (needed) {
            filesToProcess.push(file);
        }
        else {
            filesAlreadyProcessed.push(file);
        }
    }
    // For debugging, you can log which files you're processing
    filesAlreadyProcessed.forEach((file) => {
        console.log(`✅ Already processed: ${file}`);
    });
    filesToProcess.forEach((file) => {
        console.log(`🟡 Will process: ${file}`);
    });
    if (params.dryRun) {
        console.log("🛑 Dry run enabled, no files will be processed.");
        return;
    }
    // Process each file
    for (const file of filesToProcess) {
        await processFile(file, prompt, promptName, gptModel);
    }
}
// Run the script
main().catch(console.error);
