import program from "commander";
import process from "process";
import glob from "glob";
import path from 'path';
import fs from 'fs';

import { glslToJavaScriptTranspiler } from './transpiler.mjs';

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

async function main() {
  console.log("threeify-glsl-compiler");

  let input = path.normalize(program.input);
  console.log(`input directory: ${input}`);
  if (!fs.existsSync(input)) {
    throw new Error(`input directory does not exist: ${input}`);
  }

  let output = path.normalize(program.output);
  console.log(`output directory: ${output}`);
 
  let errors = [];
  // options is optional
  glob(`${input}/**/*.glsl`, {}, function (er, inputFileNames) {
    inputFileNames.forEach((inputFileName) => {
      inputFileName = path.normalize( inputFileName );
      console.log(`inputFileName: ${inputFileName}`);
      var outputFileName = inputFileName.replace( input, output ) + '.js';
      console.log(`outputFileName: ${outputFileName}`);
      glslToJavaScriptTranspiler(inputFileName, outputFileName, errors);
    });
  });
}
main();