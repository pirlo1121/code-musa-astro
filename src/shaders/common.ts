/** Appended to every custom fragment shader: applies the renderer's tone
 *  mapping and sRGB encoding when drawing straight to screen (low tier). When
 *  rendering into the post-processing buffer both chunks compile to no-ops
 *  and the composer's ToneMapping pass handles it instead. */
export const output = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;
