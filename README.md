<h1 align="center" style="border-bottom: none;">threeify-glsl-transpiler</h1>
<h3 align="center">A glsl to JS module transpiler.</h3>
<p align="center">
  <a href="https://www.npmjs.com/package/threeify-glsl-transpiler">
    <img alt="npm latest version" src="https://img.shields.io/npm/v/threeify-glsl-transpiler/latest.svg">
  </a>
  <a href="https://www.npmjs.com/package/threeify">
    <img alt="npm next version" src="https://img.shields.io/npm/v/threeify-glsl-transpiler/next.svg">
  </a>
</p>

**threeify-glsl-transpiler** is glsl to JS module transpiler. It is part of the threeify ecosystem.

The purpose of this is to allow one to use raw glsl files in JavaScript in the most easy fashion possible. Keeping glsl files as \*.glsl files has the benefits that syntax highlighers work out of the box as do linters. This allows one to maximize their productivity.

## Usage

```
threeify-glsl-transpiler
Usage: main [options]

Options:
  -p, --project <dirpath>   the root of the tsconfig project directory tree
  -s, --source <dirpath>    the root of the source directory tree
  -o, --output <dirpath>    the root of the output directory tree
  -w, --watch               watch and incremental transpile any changed files
  -c, --comments            leave comments and other non-essential components
  -j, --javascript          allow referencing javascript and typescript code via includes
  -e, --extensions <items>  comma separated list of extensions to transpile
  -i, --includes <items>    comma separated list of include directories relative to source root
  -v, --verbose <level>     higher numbers means more output (default: 0)
  -h, --help                display help for command
```

### Build

Just run it to transform all glsl files from the input directory into the corresponding
glsl.js JavaScript modules in the output directory.

```
tgt -s <input directory> -o <output directory>
```

### Watch

To have the transpiler constantly run and transpile files incrementally on change use the watch option:

```
tgt -s <input directory> -o <output directory> -w
```

## Features

- Allow you to keep your glsl files in raw glsl.
- Convert glsl files into JavaScript modules.
- Support "#pragma once" include guard creation.
- Incremental updates when in watch mode.

## Example

An original `rgbe.glsl` file:

```glsl
#pragma once
#pragma include "../../math/math.glsl"

vec4 rgbeToLinear( in vec4 value ) {
	return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}

vec4 linearToRGBE( in vec4 value ) {
	float maxComponent = max( max( value.r, value.g ), value.b );
	float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
	return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );
}
```

Will be transformed into a `rgbe.glsl.js` JavaScript module:

```javascript
import _renderers_webgl2_shaders_includes_math_math_glsl from "../../math/math.glsl.js";

export default /* glsl */ `
#ifndef _renderers_webgl2_shaders_includes_color_spaces_rgbe_glsl // start of include guard
#define _renderers_webgl2_shaders_includes_color_spaces_rgbe_glsl

${_renderers_webgl2_shaders_includes_math_math_glsl}

vec4 rgbeToLinear( in vec4 value ) {
	return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}

vec4 linearToRGBE( in vec4 value ) {
	float maxComponent = max( max( value.r, value.g ), value.b );
	float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
	return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );
}

#endif // end of include guard
`;
```

Which you can use in your JavaScript code via:

```javascript
import rgbe_code from "rgbe.glsl.js";

console.log(rgbe_cole);
```
