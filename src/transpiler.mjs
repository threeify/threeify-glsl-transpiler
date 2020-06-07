import path from 'path';
import fs from 'fs';
import makeDir from 'make-dir';

let includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm; // copied from three.js

let jsModulePrefix = 'export default /* glsl */ `\n';
let jsModulePostfix = '`;';

export async function glslToJavaScriptTranspiler( inputFileName, outputFileName, errors ) {

    let inputPath = path.dirname(inputFileName);
    let inputSource = fs.readFileSync(inputFileName, 'utf8');

    let includeImports = [];
 
    function includeReplacer( match, includeFileName ) {        
        console.log( `includeFileName ${includeFileName}` );
        var includeFilePath = path.normalize( path.join( inputPath, includeFileName ) );
        console.log( `includeFilePath ${includeFilePath}` );

   /*     if( ! fs.existsSync( includeFilePath ) ) { 
            errors.push( {
                includeFileName: includeFileName,
                type: `Can not find target of "#include <${includeFileName}>" resolve: ${includeFilePath}`
            } );
            return `#include <${includeFileName}> // ERROR: Can not find the file ${includeFilePath}`;
        }
        else {*/
            let includeVar = includeFileName.replace( /[_./]/gm, ()=> '_');
            let includeImport = `import ${includeVar} from \'${includeFileName}.js'`;
            if( includeImports.indexOf( includeImport ) < 0 ) { // handle multiple imports of the same file
                includeImports.push( includeImport );
            }
            return "${"+includeVar+"}";
        //}
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
        await makeDir(outputPath);
    }
    fs.writeFileSync(outputFileName,outputModule);
}
