#!/bin/sh
":" //# comment; exec /usr/bin/env node --experimental-modules "$0" "$@"

import program from "commander";
import fs from "fs";
import glob from "glob";
import path from "path";
import process, { exit } from "process";
import watch from "watch";
import { glslToJavaScriptTranspiler } from "./transpiler.mjs";

console.log("threeify-glsl-transpiler");

function commaSeparatedList(value, dummyPrevious) {
  return value.split(",");
}

program
  .option(
    "-p, --projectDir <dirpath>",
    `the root of the project directory tree`
  )
  .option("-r, --rootDir <dirpath>", `the root of the source directory tree`)
  .option("-o, --outDir <dirpath>", `the root of the output directory tree`)
  .option("-w, --watch", `watch and incremental transpile any changed files`)
  .option(
    "-j, --allowJSIncludes",
    `allow referencing javascript and typescript code via includes`
  )
  .option("-m, --minify", `reduce the size of the glsl code`)
  .option(
    "-e, --extensions <items>",
    "comma separated list of extensions to transpile",
    commaSeparatedList
  )
  .option(
    "-i, --includeDirs <items>",
    "comma separated list of include directories relative to source root",
    commaSeparatedList
  )
  .option(
    "-v, --verboseLevel <level>",
    `higher numbers means more output`,
    parseInt
  );

program.parse(process.argv);

function removeUndefined(obj) {
  const ret = {};
  Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .forEach((key) => (ret[key] = obj[key]));
  return ret;
}

let options = {
  rootDir: ".",
  outDir: "./dist",
  includeDirs: [],
  extensions: ["glsl"],
  minify: false,
  verboseLevel: 0,
  allowJSIncludes: false,
};

let projectDir = process.cwd();
if (program.projectDir) {
  projectDir = program.projectDir;
}

let tsConfigFilePath = path.join(projectDir, "tsconfig.json");
if (fs.existsSync(tsConfigFilePath)) {
  var tsConfig = JSON.parse(fs.readFileSync(tsConfigFilePath));
  if (tsConfig.compilerOptions) {
    if (options.verboseLevel >= 1) {
      console.log(`  inferring setup from ${tsConfigFilePath}.`);
    }
    if (tsConfig.compilerOptions.rootDir) {
      options.rootDir = tsConfig.compilerOptions.rootDir;
    }
    if (tsConfig.compilerOptions.outDir) {
      options.outDir = tsConfig.compilerOptions.outDir;
    }
  }
}

let threeifyFilePath = path.join(projectDir, "threeify.json");
if (fs.existsSync(threeifyFilePath)) {
  const threeifyConfig = JSON.parse(fs.readFileSync(threeifyFilePath));
  if (options.verboseLevel >= 1) {
    console.log(`  reading settings from ${threeifyFilePath}.`);
  }
  if (threeifyConfig.glsl) {
    options = Object.assign(options, removeUndefined(threeifyConfig.glsl));
  }
}

let cmdLineOptions = {
  rootDir: program.rootDir,
  outDir: program.outDir,
  includeDirs: program.includeDirs,
  extensions: program.extension,
  minify: program.minify,
  verboseLevel: program.verboseLevel,
  allowJSIncludes: program.allowJSIncludes,
};

cmdLineOptions = removeUndefined(cmdLineOptions);
if (Object.keys(cmdLineOptions).length > 0) {
  if (options.verboseLevel >= 1) {
    console.log(`  applying command line overrides.`);
  }
  options = Object.assign(options, cmdLineOptions);
}

options = Object.assign(options);

if (options.verboseLevel >= 2) {
  console.log(options);
}

options.extensions = options.extensions.map((ext) => ext.toLowerCase());

if (!options.rootDir) {
  console.error(`no rootDir specified`);
  exit(0);
}
if (!fs.existsSync(options.rootDir)) {
  console.error(`rootDir doesn't exist: ${options.rootDir}`);
  exit(0);
}
if (!options.outDir) {
  console.error(`no outDir specified`);
  exit(0);
}

options.rootDir = path.normalize(path.join(projectDir, options.rootDir));
options.outDir = path.normalize(path.join(projectDir, options.outDir));

options.includeDirs = options.includeDirs.map((includeDir) =>
  path.join(options.rootDir, includeDir)
);
if (options.includeDirs.length === 0) {
  options.includeDirs.push(options.rootDir);
}

if (options.verboseLevel >= 2) {
  console.log(options);
}

let numFiles = 0;
let numErrors = 0;

function inputFileNameToOutputFileName(inputFileName) {
  inputFileName = path.normalize(inputFileName);
  var outputFileName =
    inputFileName.replace(options.rootDir, options.outDir) + ".js";
  return outputFileName;
}

function transpile(sourceFileName) {
  sourceFileName = path.normalize(sourceFileName);
  var outputFileName = inputFileNameToOutputFileName(sourceFileName);
  let fileErrors = glslToJavaScriptTranspiler(
    sourceFileName,
    outputFileName,
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
    if (options.verboseLevel >= 1) {
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
  if (ext.length > 1) {
    ext = ext.slice(1);
  }
  let result = options.extensions.includes(ext.toLowerCase());
  return result;
}

// options is optional
let extGlob = options.extensions.join("|");
let globRegex = `${options.rootDir}/**/*.+(${extGlob})`;

glob(globRegex, {}, function (er, sourceFileNames) {
  sourceFileNames.forEach((inputFileName) => {
    numFiles++;
    transpile(inputFileName);
  });

  if (numErrors > 0) {
    console.error(`${numErrors} files failed to transpile.`);
  }
  console.log(`${numFiles - numErrors} files transpile successfully.`);

  if (program.watch) {
    watch.createMonitor(options.rootDir, function (monitor) {
      monitor.on("created", function (sourceFileName, stat) {
        if (options.verboseLevel > 1) console.log(`created ${sourceFileName}`);
        if (isFileSupported(sourceFileName)) {
          transpile(sourceFileName);
        }
      });
      monitor.on("changed", function (sourceFileName, curr, prev) {
        if (options.verboseLevel > 1) console.log(`changed ${sourceFileName}`);
        if (isFileSupported(sourceFileName)) {
          transpile(sourceFileName);
        }
      });
      monitor.on("removed", function (sourceFileName, stat) {
        if (options.verboseLevel > 1) console.log(`removed ${sourceFileName}`);
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
