/* ===========================================================================
   /components — EDWIN LOGOTYPE
   The official blue edwin wordmark from Phia. The source PNG carries wide
   transparent margins (the wordmark fills x 297–1458, y 200–521 of a
   1763 × 818 canvas), so it is cropped to the letterforms here and can be
   sized by its visible height.
=========================================================================== */
import logo from "../assets/brand/edwin-logotype-blue.png";

const IMG_W = 1763;
const IMG_H = 818;
const BOX = { x: 297, y: 200, w: 1161, h: 321 };

export function EdwinLogo({ height = 28 }: { height?: number }) {
  const s = height / BOX.h;
  return (
    <span
      role="img"
      aria-label="edwin"
      style={{ display: "block", position: "relative", overflow: "hidden", width: BOX.w * s, height }}
    >
      <img
        src={logo}
        alt=""
        style={{
          position: "absolute",
          maxWidth: "none",
          width: IMG_W * s,
          height: IMG_H * s,
          left: -BOX.x * s,
          top: -BOX.y * s,
        }}
      />
    </span>
  );
}
