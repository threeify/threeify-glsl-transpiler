#!/bin/sh
":"; //# comment; exec /usr/bin/env node --experimental-modules "$0" "$@"

import program from "commander";
import process from "process";
import glob from "glob";
import path from "path";
import fs from "fs";
import watch from "watch";

import { glslToJavaScriptTranspiler } from "./transpiler.mjs";

console.log("threeify-glsl-compiler");

program
  .option(
    "-p, --project <dirpath>",
    `the root of the tsconfig project directory tree`
  )
  .option("-i, --input <dirpath>", `the root of the input directory tree`)
  .option("-o, --output <dirpath>", `the root of the output directory tree`)
  .option("-w, --watch", `watch and incremental transpile any changed files`)
  .option(
    "-v, --verbose <level>",
    `higher numbers means more output`,
    parseInt,
    0
  );

program.parse(process.argv);

let verbose = program.verbose;

let input = null;
let output = null;

if (program.project) {
  let tsConfigFilePath = path.join(program.project, "/tsconfig.json");
  if (fs.existsSync(tsConfigFilePath)) {
    var tsConfig = JSON.parse(fs.readFileSync(tsConfigFilePath));
    if (tsConfig.compilerOptions) {
      if (tsConfig.compilerOptions.rootDir) {
        input = path.join(program.project, tsConfig.compilerOptions.rootDir);
      }
      if (tsConfig.compilerOptions.outDir) {
        output = path.join(program.project, tsConfig.compilerOptions.outDir);
      }
    }
  } else {
    console.error(
      `Can not find a tsconfig.json file here: ${tsConfigFilePath}`
    );
  }
}

if (program.input) {
  input = program.input;
}
if (program.output) {
  output = program.output;
}

output = path.normalize(output);
input = path.normalize(input);

if (!fs.existsSync(input)) {
  throw new Error(`input directory does not exist: ${input}`);
}
if (verbose >= 1) {
  console.log(`  output: ${output}`);
}

if (verbose >= 1) {
  console.log(`  input: ${input}`);
}

let numFiles = 0;
let numErrors = 0;

function inputFileNameToOutputFileName(inputFileName) {
  inputFileName = path.normalize(inputFileName);
  var outputFileName = inputFileName.replace(input, output) + ".js";
  return outputFileName;
}

function transpile(inputFileName) {
  inputFileName = path.normalize(inputFileName);
  var outputFileName = inputFileNameToOutputFileName(inputFileName);
  let fileErrors = glslToJavaScriptTranspiler(
    input,
    inputFileName,
    output,
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
        `  ${path.basename(inputFileName)} --> ${path.basename(outputFileName)}`
      );
    }
  }
  return fileErrors;
}

// options is optional
glob(`${input}/**/*.glsl`, {}, function (er, inputFileNames) {
  inputFileNames.forEach((inputFileName) => {
    numFiles++;
    transpile(inputFileName);
  });

  if (numErrors > 0) {
    console.error(`${numErrors} files failed to transpile.`);
  }
  console.log(`${numFiles - numErrors} files transpile successfully.`);

  if (program.watch) {
    watch.createMonitor(input, function (monitor) {
      monitor.on("created", function (inputFileName, stat) {
        if (verbose > 1) console.log(`created ${inputFileName}`);
        if (inputFileName.indexOf(".glsl") >= 0) {
          transpile(inputFileName);
        }
      });
      monitor.on("changed", function (inputFileName, curr, prev) {
        if (verbose > 1) console.log(`changed ${inputFileName}`);
        if (inputFileName.indexOf(".glsl") >= 0) {
          transpile(inputFileName);
        }
      });
      monitor.on("removed", function (inputFileName, stat) {
        if (verbose > 1) console.log(`removed ${inputFileName}`);
        if (inputFileName.indexOf(".glsl") >= 0) {
          let outputFileName = inputFileNameToOutputFileName(inputFileName);
          if (fs.existsSync(outputFileName)) {
            fs.unlink(outputFileName);
          }
        }
      });
    });
  }
});
