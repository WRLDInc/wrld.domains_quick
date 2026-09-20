/**
 * Roll-text label, the wrld.design CTA signature: the label sits in a
 * one-line window and the parent's hover slides it up to reveal a copy of
 * itself. The copy is drawn by CSS (`::after` reading `data-label`) so the
 * accessibility tree only ever sees the label once. Put it inside a `.btn`;
 * the CSS lives under `.roll` in global.css.
 */
export function RollText({ children }: { children: string }) {
  return (
    <span className="roll">
      <span data-label={children}>
        <i>{children}</i>
      </span>
    </span>
  );
}

