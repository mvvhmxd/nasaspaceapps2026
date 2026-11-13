// Contour colours as three.js colours (linear light) and CSS (sRGB), from the one
// table in contours.js, so the glyph pass, the plain (Off) view and the map key match.
import * as THREE from 'three';
import { PALETTE } from '../theme.js';
import { CONTOUR_STYLE } from './contours.js';

/** Linear-light colour for a CONTOUR_STYLE entry ('minorShadow', 'majorLit', ...). */
export function contourColor(name) {
  const { key, scale } = CONTOUR_STYLE[name];
  return new THREE.Color(PALETTE[key]).multiplyScalar(scale);
}

/** The same colour as a CSS string (sRGB), for DOM samples such as the map key. */
export function contourCss(name) {
  return `#${contourColor(name).getHexString()}`;
}
