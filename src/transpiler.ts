import fs from "fs";
import makeDir from "make-dir";
import path from "path";
import { stripComments, stripUnnecessaryLineEndings, stripUnnecessarySpaces } from "./minification";

let includeLocalRegex = /^[ \t]*#(?:pragma +)?include +["]([\w\d./]+)["]/gm; // modified from three.js
let includeAbsoluteRegex = /^[ \t]*#(?:pragma +)?include +[<]([\w\d./]+)[>]/gm; // modified from three.js
let jsModulePrefix = "export default /* glsl */ `\n";
let jsModulePostfix = "`;";

export function glslToJavaScriptTranspiler(
  sourceFileName:string,
  outputFileName:string,
  options:any
) {
  let sourcePath = path.dirname(sourceFileName);
  let sourceCode = fs.readFileSync(sourceFileName, "utf8");

  let includeGuardName = sourceFileName
    .replace(options.rootDir, "")
    .replace(/[_./]/gm, "_");

  let includeImports:string[] = [];

  let errors:string[] = [];

  let searchExtensions = options.extensions.map((e) => "." + e);
  searchExtensions.push("");

  if (options.allowJSIncludes) {
    searchExtensions.slice(0).forEach((e) => {
      searchExtensions.push(e + ".ts");
      searchExtensions.push(e + ".js");
    });
  }

  function includeReplacer(searchDirectories:string[]) {
    return function (match:String, sourceFileName:string) {
      //console.log(
      //  "-----------------------------------------------------------------------"
      //);
      //console.log("resolving:", match);
      if (!sourceFileName) return "";

      /*if (includeFileName.indexOf(".glsl") < 0) {
      // auto add glsl extension if it is missing.
      includeFileName += ".glsl";
    }*/
      //console.log( `includeFileName ${includeFileName}` );

      let directories = searchDirectories.slice(0);
      // directories.push(sourcePath);

      let pathsAttempted:string[] = [];
      var includeFilePath:string|undefined = undefined;
      directories.forEach((directory: string) => {
        let testIncludeFilePath = path.normalize(
          path.join(directory, sourceFileName)
        );
        searchExtensions.forEach((extension:string) => {
          let test2IncludeFilePath = testIncludeFilePath + extension;
          pathsAttempted.push(test2IncludeFilePath);
          if (fs.existsSync(test2IncludeFilePath)) {
            includeFilePath = test2IncludeFilePath;
          }
        });
      });

      //console.log( `includeFilePath ${includeFilePath}` );

      if (includeFilePath === undefined) {
        const errorMsg = `Could not resolve "${match}" - current directory ${sourcePath}, attempts: ${pathsAttempted.join(
          ","
        )}`;
        //console.error(errorMsg);
        errors.push(errorMsg);
        return errorMsg;
      } else {
        var includeVar = includeFilePath
          .replace(options.rootDir, "")
          .replace(/[_./]/gm, "_");
        var relativeIncludePath = path.relative(sourcePath, includeFilePath);
        if (relativeIncludePath.indexOf(".") !== 0) {
          relativeIncludePath = "./" + relativeIncludePath;
        }
        let includeImport = `import ${includeVar} from \'${relativeIncludePath}.js'`;
        if (includeImports.indexOf(includeImport) < 0) {
          // handle multiple imports of the same file
          includeImports.push(includeImport);
        }
        return "${" + includeVar + "}";
      }
    };
  }

  let outputSource = sourceCode;

  if (options.minify) {
    outputSource = stripComments( outputSource );
    outputSource = stripUnnecessaryLineEndings( outputSource)
    outputSource = stripUnnecessarySpaces( outputSource );
  }

  if (sourceCode.indexOf("#pragma once") >= 0) {
    let includeGuardPrefix = `#ifndef ${includeGuardName}\n#define ${includeGuardName}\n`;
    let includeGuardPostfix = `\n\n#endif // end of include guard`;

    outputSource =
      includeGuardPrefix +
      outputSource.replace(/#pragma once/gm, "") +
      "\n" +
      includeGuardPostfix;
  }

  outputSource = outputSource.replace(
    includeLocalRegex,
    includeReplacer([sourcePath])
  );
  outputSource = outputSource.replace(
    includeAbsoluteRegex,
    includeReplacer(options.includeDirs)
  );

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
