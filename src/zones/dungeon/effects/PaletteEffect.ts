import { Effect } from 'postprocessing'
import { Color, Uniform, Vector3 } from 'three'

const MAX_COLOURS = 16

/**
 * sRGB components in [0, 1], padded with the last colour up to the shader's array size. The shader compares colours in
 * sRGB, where the eye judges distances: dark tones then dither as much as light ones.
 */
export function paletteUniform(colours: readonly string[]): Vector3[] {
  const vectors = colours.map((hex) => {
    const colour = new Color(hex)
    colour.convertLinearToSRGB()
    return new Vector3(colour.r, colour.g, colour.b)
  })
  while (vectors.length < MAX_COLOURS) vectors.push(vectors[vectors.length - 1].clone())
  return vectors
}

const fragmentShader = /* glsl */ `
uniform vec3 athenaPalette[${MAX_COLOURS}];
uniform int athenaCount;
uniform float athenaCell;
uniform float athenaSpread;
uniform float athenaScanlines;

// 4 x 4 ordered dither, centred on zero.
float paletteBayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return float(m[x + y * 4]) / 16.0 - 0.5;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // One dither value per pixelated block, so the pattern sits on the big pixels.
  vec2 block = floor(gl_FragCoord.xy / athenaCell);
  vec3 colour = pow(max(inputColor.rgb, vec3(0.0)), vec3(1.0 / 2.2)) + paletteBayer(block) * athenaSpread;
  vec3 best = athenaPalette[0];
  float bestDistance = 1e9;
  for (int i = 0; i < ${MAX_COLOURS}; i++) {
    if (i >= athenaCount) break;
    vec3 d = colour - athenaPalette[i];
    float gap = dot(d, d);
    if (gap < bestDistance) {
      bestDistance = gap;
      best = athenaPalette[i];
    }
  }
  // Monochrome scanlines: every other row of screen pixels a little darker, like an old TV.
  float row = mod(floor(gl_FragCoord.y), 2.0);
  outputColor = vec4(pow(best, vec3(2.2)) * (1.0 - athenaScanlines * row), inputColor.a);
}
`

/**
 * Uniform names carry an athena prefix: the composer merges effects into one shader, and Scanline has its own count.
 */
/** Spec 3, §4.4: snaps every pixel block to the Athena palette with a 4 x 4 ordered dither, and draws the scanlines. */
export class PaletteEffect extends Effect {
  constructor({ colours, cell, spread = 0.04, scanlines = 0.18 }: { colours: string[]; cell: number; spread?: number; scanlines?: number }) {
    super('PaletteEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['athenaPalette', new Uniform(paletteUniform(colours))],
        ['athenaCount', new Uniform(Math.min(colours.length, MAX_COLOURS))],
        ['athenaCell', new Uniform(cell)],
        ['athenaSpread', new Uniform(spread)],
        ['athenaScanlines', new Uniform(scanlines)],
      ]),
    })
  }
}
