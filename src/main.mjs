#!/bin/sh 
":" //# comment; exec /usr/bin/env node --experimental-modules "$0" "$@"

import program from "commander";
import process from "process";
import glob from "glob";
import path from "path";
import fs from "fs";
import watch from 'watch';

import { glslToJavaScriptTranspiler } from "./transpiler.mjs";

console.log("threeify-glsl-compiler");

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
    "-w, --watch",
    `watch and incremental transpile any changed files`
  )
  .option(
    "-v, --verbose <level>",
    `higher numbers means more output`,
    parseInt,
    0
  );

program.parse(process.argv);

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

let numFiles = 0;
let numErrors = 0;

function inputFileNameToOutputFileName( inputFileName ) {
  inputFileName = path.normalize(inputFileName);
  var outputFileName = inputFileName.replace(input, output) + ".js";
  return outputFileName;
}

function transpile( inputFileName ) {
  inputFileName = path.normalize(inputFileName);
    var outputFileName = inputFileNameToOutputFileName( inputFileName );
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
          `  ${path.basename(inputFileName)} --> ${path.basename(
            outputFileName
          )}`
        );
      }
    }
    return fileErrors;
}

// options is optional
glob(`${input}/**/*.glsl`, {}, function (er, inputFileNames) {
  inputFileNames.forEach((inputFileName) => {
    numFiles++;
    transpile( inputFileName );
  });

  if (numErrors > 0) {
    console.error(`${numErrors} files failed to transpile.`);
  }
  console.log(`${numFiles - numErrors} files transpile successfully.`);


  if( program.watch ) {
    watch.createMonitor(input, function (monitor) {
      monitor.on("created", function (inputFileName, stat) {
        console.log( `created ${inputFileName}`);
        if( inputFileName.indexOf( '.glsl' ) >= 0 ) {
          transpile( inputFileName );
        }
      });
      monitor.on("changed", function (inputFileName, curr, prev) {
        console.log( `changed ${inputFileName}`);
        if( inputFileName.indexOf( '.glsl' ) >= 0 ) {
          transpile( inputFileName );
        }
      });
      monitor.on("removed", function (inputFileName, stat) {
        console.log( `removed ${inputFileName}`);
        if( inputFileName.indexOf( '.glsl' ) >= 0 ) {
          let outputFileName = inputFileNameToOutputFileName( inputFileName );
          if( fs.existsSync( outputFileName ) ) {
            fs.unlink( outputFileName );
          }
        }
      });
    });
  }

});