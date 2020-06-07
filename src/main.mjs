import program from "commander";
import process from "process";
import glob from "glob";
import path from "path";
import fs from "fs";

import { glslToJavaScriptTranspiler } from "./transpiler.mjs";

program
  .requiredOption(
    "-i, --input <dirpath>",
    `the root of the input directory tree`
  )
  .requiredOption(
    "-o, --output <dirpath>",
    `the root of the output directory tree`
  )
  .option(
    "-v, --verbose <level>",
    `higher numbers means more output`,
    parseInt,
    0
  );

program.parse(process.argv);

console.log("threeify-glsl-compiler");

let verbose = program.verbose;

let input = path.normalize(program.input);
if (verbose >= 1) {
  console.log(`  input: ${input}`);
}
if (!fs.existsSync(input)) {
  throw new Error(`input directory does not exist: ${input}`);
}

let output = path.normalize(program.output);
if (verbose >= 1) {
  console.log(`  output: ${output}`);
}

// options is optional
glob(`${input}/**/*.glsl`, {}, function (er, inputFileNames) {
  let numFiles = 0;
  let numErrors = 0;
  inputFileNames.forEach((inputFileName) => {
    numFiles++;
    inputFileName = path.normalize(inputFileName);
    var outputFileName = inputFileName.replace(input, output) + ".js";
    let fileErrors = glslToJavaScriptTranspiler(
      inputFileName,
      outputFileName,
      verbose
    );
    if (fileErrors.length > 0) {
      numErrors++;
      console.error(
        `  ${path.basename(inputFileName)} --> ${path.basename(
          outputFileName
        )}: ${fileErrors.length} Errors.`
      );
      fileErrors.forEach((error) => {
        console.error(`    ${error}`);
      });
    } else {
      if (verbose >= 1) {
        console.log(
          `  ${path.basename(inputFileName)} --> ${path.basename(
            outputFileName
          )}`
        );
      }
    }
  });

  if (numErrors > 0) {
    console.error(`${numErrors} files failed to transpile.`);
  }
  console.log(`${numFiles - numErrors} files transpile successfully.`);
});
