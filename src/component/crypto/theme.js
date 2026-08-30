/* The one place the chart colours are defined.
 *
 * The svg charts set their strokes from javascript, the rest of the interface
 * from css, so both read these and cannot drift apart. The values are the
 * validated defaults from the data visualisation palette, checked against this
 * app's own dark surface (#131822) rather than assumed:
 *
 *   series slots 1-4   all pass the lightness band, chroma floor, colour
 *                      vision separation and 3:1 contrast
 *   good / critical    5.30:1 and 3.70:1 on the surface
 *
 * Up and down always carry a + or - sign beside them as well, so the colour
 * never has to do the work on its own.
 */
export const COLORS = {
  // categorical slots, in the fixed order. never cycled, never generated
  series: ["#3987e5", "#d95926", "#199e70", "#c98500"],
  // status, reserved: these never stand in for a series
  good: "#0ca30c",
  critical: "#d03b3b",
  // chart chrome
  ink: "#ffffff",
  inkSecondary: "#c3c2b7",
  muted: "#898781",
  grid: "#242b38",
  axis: "#2f394a",
  surface: "#131822",
};

export const directionColor = (value) =>
  value === null || value === undefined || Number.isNaN(value)
    ? COLORS.muted
    : value >= 0
    ? COLORS.good
    : COLORS.critical;
