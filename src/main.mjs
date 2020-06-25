#!/bin/sh
":"; //# comment; exec /usr/bin/env node --experimental-modules "$0" "$@"

import program from "commander";
import fs from "fs";
import glob from "glob";
import path from "path";
import process, { exit } from "process";
import watch from "watch";
import { glslToJavaScriptTranspiler } from "./transpiler.mjs";

console.log("threeify-glsl-compiler");

function commaSeparatedList(value, dummyPrevious) {
  return value.split(",");
}

program
  .option(
    "-p, --project <dirpath>",
    `the root of the tsconfig project directory tree`
  )
  .option("-s, --source <dirpath>", `the root of the source directory tree`)
  .option("-o, --output <dirpath>", `the root of the output directory tree`)
  .option("-w, --watch", `watch and incremental transpile any changed files`)
  .option("-c, --comments", `leave comments and other non-essential components`)
  .option(
    "-j, --javascript",
    `allow referencing javascript and typescript code via includes`
  )
  .option(
    "-e, --extensions <items>",
    "comma separated list of extensions to transpile",
    commaSeparatedList
  )
  .option(
    "-i, --includes <items>",
    "comma separated list of include directories relative to source root",
    commaSeparatedList
  )
  .option(
    "-v, --verbose <level>",
    `higher numbers means more output`,
    parseInt,
    0
  );

program.parse(process.argv);

let options = {
  verbose: 0,
  comments: false,
  javascript: false,
};
options.verbose = program.verbose;
options.comments = !!program.comments;
options.javascript = !!program.javascript;

let source = null;
let output = null;
let project = null;
let extensions = ["glsl"];
let includeDirectories = [];

if (program.extensions !== undefined) {
  extensions = program.extensions;
}
if (program.includes !== undefined) {
  includeDirectories = program.includes;
}

if (program.project) {
  project = program.project;
}

if (!project) {
  project = process.cwd();
}

let threeifyFilePath = path.join(project, "/threeify.json");
if (fs.existsSync(threeifyFilePath)) {
  var threeifyConfig = JSON.parse(fs.readFileSync(threeifyFilePath));
  if (threeifyConfig.glsl) {
    var config = threeifyConfig.glsl;
    if (config.sourceDir) {
      source = path.join(project, config.sourceDir);
    }
    if (config.outputDir) {
      output = path.join(project, config.outputDir);
    }
    if (config.extensions) {
      extensions = config.extensions;
    }
    if (config.includeDirs) {
      config.includeDirs.forEach((includeDir) => {
        includeDirectories.push(includeDir);
      });
    }
  }
}

let tsConfigFilePath = path.join(project, "/tsconfig.json");
if (fs.existsSync(tsConfigFilePath)) {
  var tsConfig = JSON.parse(fs.readFileSync(tsConfigFilePath));
  if (tsConfig.compilerOptions) {
    if (!source && tsConfig.compilerOptions.rootDir) {
      source = path.join(project, tsConfig.compilerOptions.rootDir);
    }
    if (!output && tsConfig.compilerOptions.outDir) {
      output = path.join(project, tsConfig.compilerOptions.outDir);
    }
  }
}

extensions = extensions.map((ext) => ext.toLowerCase());

if (program.input) {
  source = program.input;
}
if (program.output) {
  output = program.output;
}

if (!source) {
  console.error(`no source directory specified`);
  exit(0);
}
if (!fs.existsSync(source)) {
  console.error(`can not find source directory: ${source}`);
  exit(0);
}
if (!output) {
  console.error(`no output directory specified and no tsconfig.json`);
  exit(0);
}

includeDirectories = includeDirectories.map((dir) => path.join(source, dir));
if (includeDirectories.length === 0) {
  includeDirectories.push(source);
}

output = path.normalize(output);
source = path.normalize(source);

if (options.verbose >= 1) {
  console.log(`  output: ${output}`);
}

if (options.verbose >= 1) {
  console.log(`  input: ${source}`);
}

let numFiles = 0;
let numErrors = 0;

function inputFileNameToOutputFileName(inputFileName) {
  inputFileName = path.normalize(inputFileName);
  var outputFileName = inputFileName.replace(source, output) + ".js";
  return outputFileName;
}

function transpile(sourceFileName) {
  sourceFileName = path.normalize(sourceFileName);
  var outputFileName = inputFileNameToOutputFileName(sourceFileName);
  let fileErrors = glslToJavaScriptTranspiler(
    includeDirectories,
    source,
    sourceFileName,
    output,
    outputFileName,
    extensions,
    options
  );

  if (fileErrors.length > 0) {
    numErrors++;
    console.error(
      `  ${path.basename(sourceFileName)} --> ${path.basename(
        outputFileName
      )}: ${fileErrors.length} Errors.`
    );
    fileErrors.forEach((error) => {
      console.error(`    ${error}`);
    });
  } else {
    if (options.verbose >= 1) {
      console.log(
        `  ${path.basename(sourceFileName)} --> ${path.basename(
          outputFileName
        )}`
      );
    }
  }
  return fileErrors;
}

function isFileSupported(fileName) {
  let ext = path.extname(fileName);
  return extensions.includes(ext.toLowerCase());
}

// options is optional
let extGlob = extensions.join("|");
glob(`${source}/**/*.+(${extGlob})`, {}, function (er, sourceFileNames) {
  sourceFileNames.forEach((inputFileName) => {
    numFiles++;
    transpile(inputFileName, source, output);
  });

  if (numErrors > 0) {
    console.error(`${numErrors} files failed to transpile.`);
  }
  console.log(`${numFiles - numErrors} files transpile successfully.`);

  if (program.watch) {
    watch.createMonitor(source, function (monitor) {
      monitor.on("created", function (sourceFileName, stat) {
        if (options.verbose > 1) console.log(`created ${sourceFileName}`);
        if (isFileSupported(sourceFileName)) {
          transpile(sourceFileName);
        }
      });
      monitor.on("changed", function (sourceFileName, curr, prev) {
        if (options.verbose > 1) console.log(`changed ${sourceFileName}`);
        if (isFileSupported(sourceFileName)) {
          transpile(sourceFileName);
        }
      });
      monitor.on("removed", function (sourceFileName, stat) {
        if (options.verbose > 1) console.log(`removed ${sourceFileName}`);
        if (isFileSupported(sourceFileName)) {
          let outputFileName = inputFileNameToOutputFileName(sourceFileName);
          if (fs.existsSync(outputFileName)) {
            fs.unlink(outputFileName);
          }
        }
      });
    });
  }
});
