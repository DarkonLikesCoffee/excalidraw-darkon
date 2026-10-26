import {
  FONT_FAMILY,
  getLineHeight,
  getVerticalOffset,
  registerPersonalFontMetrics,
  unregisterPersonalFontMetrics,
} from "@excalidraw/common";

import { Fonts } from "../fonts/Fonts";

const PERSONAL_FONT_ID = 1001;

const mockFontMetrics = (metrics: {
  fontBoundingBoxAscent?: number;
  fontBoundingBoxDescent?: number;
}) =>
  vi
    .spyOn(CanvasRenderingContext2D.prototype, "measureText")
    .mockReturnValue({ width: 0, ...metrics } as TextMetrics);

describe("personal font metrics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    unregisterPersonalFontMetrics(PERSONAL_FONT_ID);
  });

  it("measures ascent and descent of the loaded font", () => {
    mockFontMetrics({
      fontBoundingBoxAscent: 950,
      fontBoundingBoxDescent: 250,
    });

    expect(
      Fonts.measurePersonalFontMetrics("ExcalidrawPersonalFont-1001"),
    ).toEqual({
      unitsPerEm: 1000,
      ascender: 950,
      descender: -250,
      lineHeight: 1.25,
    });
  });

  it("grows the line height of very tall fonts", () => {
    mockFontMetrics({
      fontBoundingBoxAscent: 1300,
      fontBoundingBoxDescent: 420,
    });

    expect(
      Fonts.measurePersonalFontMetrics("ExcalidrawPersonalFont-1001")
        ?.lineHeight,
    ).toBe(1.75);
  });

  it("returns null when the browser doesn't report font metrics", () => {
    mockFontMetrics({});

    expect(
      Fonts.measurePersonalFontMetrics("ExcalidrawPersonalFont-1001"),
    ).toBeNull();
  });

  it("positions text using the personal font's own metrics", () => {
    const fontSize = 20;
    const lineHeightPx = fontSize * 1.25;
    // without measured metrics, personal fonts fall back to Excalifont's
    const fallbackOffset = getVerticalOffset(
      FONT_FAMILY.Excalifont,
      fontSize,
      lineHeightPx,
    );
    expect(
      getVerticalOffset(PERSONAL_FONT_ID as any, fontSize, lineHeightPx),
    ).toBe(fallbackOffset);

    registerPersonalFontMetrics(PERSONAL_FONT_ID, {
      unitsPerEm: 1000,
      ascender: 1000,
      descender: -200,
      lineHeight: 1.6,
    });

    // baseline: ascender + half of the remaining line gap
    expect(
      getVerticalOffset(PERSONAL_FONT_ID as any, fontSize, lineHeightPx),
    ).toBeCloseTo(20 + (25 - 24) / 2);
    expect(getLineHeight(PERSONAL_FONT_ID as any)).toBe(1.6);
  });
});
