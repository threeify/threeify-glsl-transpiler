import fs from "fs";
import makeDir from "make-dir";
import path from "path";

let includeLocalRegex = /^[ \t]*#(?:pragma +)?include +["]([\w\d./]+)["]/gm; // modified from three.js
let includeAbsoluteRegex = /^[ \t]*#(?:pragma +)?include +[<]([\w\d./]+)[>]/gm; // modified from three.js
let commentRegex = /\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm; // https://stackoverflow.com/a/15123777
let jsModulePrefix = "export default /* glsl */ `\n";
let jsModulePostfix = "`;";

export function glslToJavaScriptTranspiler(
  sourceFileName,
  outputFileName,
  options
) {
  let sourcePath = path.dirname(sourceFileName);
  let sourceCode = fs.readFileSync(sourceFileName, "utf8");

  let includeGuardName = sourceFileName
    .replace(options.rootDir, "")
    .replace(/[_./]/gm, "_");

  let includeImports = [];

  let errors = [];

  let searchExtensions = options.extensions.map((e) => "." + e);
  searchExtensions.push("");

  if (options.allowJSIncludes) {
    searchExtensions.slice(0).forEach((e) => {
      searchExtensions.push(e + ".ts");
      searchExtensions.push(e + ".jss");
    });
  }

  function includeReplacer(searchDirectories) {
    return function (match, sourceFileName) {
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

      let pathsAttempted = [];
      var includeFilePath = undefined;
      directories.forEach((directory) => {
        let testIncludeFilePath = path.normalize(
          path.join(directory, sourceFileName)
        );
        searchExtensions.forEach((extension) => {
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
          var relativeIncludePath = path.relative(sourcePath,includeFilePath);
          if( relativeIncludePath.indexOf('.') !== 0 ) {
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
    // remove comments
    outputSource = outputSource.replace(commentRegex, "");
    // remove unnecessary line ends
    outputSource = outputSource.replace(/[\r\n]+/g, '\n');
    // remove double+ spaces
    outputSource = outputSource.replace(/[ \t]+/g, ' ');
    // remove spaces between symbols
    const specialChars = [ '(', ')', ',', '=', ';', '+', '-', '*', '/', '&', '|', '%', '~', '.', ':', '[', ']','?'];
    for( let i = 0; i < specialChars.length; i ++ ) {
      let lastLength = 0;
      while( lastLength !== outputSource.length ) {
        lastLength = outputSource.length;
        outputSource = outputSource.replace( specialChars[i] + ' ', specialChars[i]); 
        outputSource = outputSource.replace( ' ' + specialChars[i], specialChars[i]);
      }
    }
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
