import { useEffect, useState } from "react";

/* True on a narrow screen.
 *
 * The charts need this because an svg viewBox is scaled to fit its container:
 * a 900 unit wide chart squeezed into a 393px phone renders at 44%, which
 * turns an 11px axis label into 5px and a 300 unit tall chart into a 130px
 * sliver. On a phone they switch to a narrower viewBox instead, so the scale
 * lands near 1:1 and the text is the size it says it is.
 */
export function useCompact(query = "(max-width: 720px)") {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [compact, setCompact] = useState(read);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const onChange = (event) => setCompact(event.matches);
    // the old api is still what some webviews expose
    if (media.addEventListener) media.addEventListener("change", onChange);
    else media.addListener(onChange);
    setCompact(media.matches);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", onChange);
      else media.removeListener(onChange);
    };
  }, [query]);

  return compact;
}
