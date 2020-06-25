import fs from "fs";
import makeDir from "make-dir";
import path from "path";

let includeRegex = /^[ \t]*#(pragma +)?include +[<"](?<filePath>[\w\d./]+)[>"]/gm; // modified from three.js
let commentRegex = /\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm; // https://stackoverflow.com/a/15123777
let jsModulePrefix = "export default /* glsl */ `\n";
let jsModulePostfix = "`;";

export function glslToJavaScriptTranspiler(
  inputDirectory,
  inputFileName,
  outputDirectory,
  outputFileName,
  options
) {
  let inputPath = path.dirname(inputFileName);
  let inputSource = fs.readFileSync(inputFileName, "utf8");

  let includeGuardName = inputFileName
    .replace(inputDirectory, "")
    .replace(/[_./]/gm, "_");

  let includeImports = [];

  let errors = [];

  function includeReplacer(match, includeFileName) {
    console.log("match", match);
    console.log("includeFileName", includeFileName);
    if (!includeFileName) return "";

    if (includeFileName.indexOf(".glsl") < 0) {
      // auto add glsl extension if it is missing.
      includeFileName += ".glsl";
    }
    //console.log( `includeFileName ${includeFileName}` );

    var includeFilePath = path.normalize(path.join(inputPath, includeFileName));
    //console.log( `includeFilePath ${includeFilePath}` );

    if (!fs.existsSync(includeFilePath)) {
      errors.push(
        `#include <${includeFileName}> - Can not find the resolved target: ${includeFilePath}'`
      );
      return `#include <${includeFileName}> // ERROR: Can not find the resolved target: ${includeFilePath}`;
    } else {
      var includeVar = includeFilePath
        .replace(inputDirectory, "")
        .replace(/[_./]/gm, "_");
      let includeImport = `import ${includeVar} from \'${includeFileName}.js'`;
      if (includeImports.indexOf(includeImport) < 0) {
        // handle multiple imports of the same file
        includeImports.push(includeImport);
      }
      return "${" + includeVar + "}";
    }
  }

  let outputSource = inputSource;

  if (options.removeComments) {
    outputSource = outputSource.replace(commentRegex, "");
  }

  if (inputSource.indexOf("#pragma once") >= 0) {
    let includeGuardPrefix = `#ifndef ${includeGuardName}\n#define ${includeGuardName}\n`;
    let includeGuardPostfix = `\n\n#endif // end of include guard`;

    outputSource =
      includeGuardPrefix +
      outputSource.replace(/#pragma once/gm, "") +
      "\n" +
      includeGuardPostfix;
  }

  outputSource = outputSource.replace(includeRegex, includeReplacer);

  let outputModule = includeImports.join("\n");
  if (outputModule.length > 0) {
    outputModule += "\n\n";
  }
  outputModule += jsModulePrefix + outputSource + "\n" + jsModulePostfix;

  let outputPath = path.dirname(outputFileName);
  if (!fs.existsSync(outputPath)) {
    makeDir.sync(outputPath);
  }
  fs.writeFileSync(outputFileName, outputModule);

  return errors;
}
