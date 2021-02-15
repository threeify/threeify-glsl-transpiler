
function parseString( token: any, defaultValue: string): string {
    if( token === undefined ) {
      return defaultValue;
    }
    if( typeof( token ) === 'string' ) {
        return token;
    }
  throw new Error( `unhandled string value: ${token}`);
}

function parseStringArray( token: any, defaultValue: string[]): string[] {
if( token === undefined ) {
      return defaultValue;
    }
   if( typeof( token ) === 'object' ) {
     let result:string[] = [];
          token.foreach( ( index: any, value: any ) => {
            result.push( parseString( value, '' ) );
          });
          // remove empty values.
          return result.filter( value => value !== '' );
    }
    throw new Error( `unhandled string value: ${token}`);
}

function parseBoolean( token: any, defaultValue: boolean ): boolean {
  if( token === undefined ) {
    return defaultValue;
  }
  if( typeof( token ) === 'string' ) {
    if( token.toLowerCase() === 'true' || token === '1' || token.toLowerCase() === 't' ) {
      return true;
    }
    if( token.toLowerCase() === 'false' || token === '0' || token.toLowerCase() === 'f' ) {
      return false;
    }
  }
  throw new Error( `unhandled boolean value: ${token}`);
}


function parseInteger( token: any, defaultValue: number ): number {
  if( token === undefined ) {
    return defaultValue;
  }
  if( typeof( token ) === 'string' ) {
    return parseInt( token );
  }
  throw new Error( `unhandled boolean value: ${token}`);
}

export class Options {
  rootDir: string = ".";
  outDir: string = "./dist";
  includeDirs: string[] = [];
  extensions: string[] = ['glsl'];
  minify: boolean = false;
  verboseLevel: number = 0;
  allowJSIncludes: boolean = false;

  safeCopy( json: any ) {
      this.rootDir = parseString( json.rootDir, this.rootDir );
      this.outDir = parseString( json.outDir, this.outDir );
     
      this.includeDirs.concat( parseStringArray( json.includeDirs, []));
      this.extensions.concat( parseStringArray( json.extensions, []));
      this.minify = parseBoolean( json.minify, this.minify );
        this.verboseLevel = parseInteger( json.verboseLevel, this.verboseLevel );
      this.allowJSIncludes = parseBoolean( json.allowJSIncludes, this.allowJSIncludes );
  }
}