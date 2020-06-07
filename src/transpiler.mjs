import path from 'path';
import fs from 'fs';
import makeDir from 'make-dir';

let includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm; // copied from three.js

let jsModulePrefix = 'export default /* glsl */ `\n';
let jsModulePostfix = '`;';

export function glslToJavaScriptTranspiler( inputFileName, outputFileName, errors, verboseLevel ) {

    let inputPath = path.dirname(inputFileName);
    let inputSource = fs.readFileSync(inputFileName, 'utf8');

    let includeImports = [];
 
    function includeReplacer( match, includeFileName ) {        
        // auto add glsl extension if it is missing.
        if( includeFileName.indexOf('.glsl') < 0 ) {
            includeFileName += '.glsl';
        }
        //console.log( `includeFileName ${includeFileName}` );

        var includeFilePath = path.normalize( path.join( inputPath, includeFileName ) );
        //console.log( `includeFilePath ${includeFilePath}` );
        

        if( ! fs.existsSync( includeFilePath ) ) { 
            console.error( `ERROR: ${inputFileName}: '#include <${includeFileName}> - Can not find the resolved target: ${includeFilePath}'`);
            return `#include <${includeFileName}> // ERROR: Can not find the resolved target: ${includeFilePath}`;
        }
        else {
            let includeVar = includeFileName.replace( /[_./]/gm, ()=> '_');
            let includeImport = `import ${includeVar} from \'${includeFileName}.js'`;
            if( includeImports.indexOf( includeImport ) < 0 ) { // handle multiple imports of the same file
                includeImports.push( includeImport );
            }
            return "${"+includeVar+"}";
        }
    }

    let outputSource = inputSource.replace( includePattern, includeReplacer );
    let outputModule = includeImports.join( '\n' );
    if( outputModule.length > 0 ) {
        outputModule += '\n\n';
    }
    outputModule += jsModulePrefix + outputSource + '\n' + jsModulePostfix;

   // console.log( outputModule );
    let outputPath = path.dirname(outputFileName);
    if( ! fs.existsSync( outputPath ) ) { 
        makeDir.sync(outputPath);
    }
    fs.writeFileSync(outputFileName,outputModule);
}
