import { LOCAL_FONT_PROTOCOL } from "@excalidraw/common";

import { type ExcalidrawFontFaceDescriptor } from "../Fonts";

/**
 * Uses the operating system's installed Palatino Linotype font.
 * This font is intentionally local-only and is not embedded in exports.
 */
export const PalatinoFontFaces: ExcalidrawFontFaceDescriptor[] = [
  {
    uri: LOCAL_FONT_PROTOCOL,
  },
];
