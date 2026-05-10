import { useCallback, useEffect, useRef, useState } from "react";

/** Returns `[setRef, isIntersecting]`.
 *
 *  Use as a callback ref:  <div ref={setRef} />
 *
 *  Why a callback ref (not a RefObject)? — the observed element may not be in
 *  the DOM on first render (e.g. a parent shows a loading spinner first, then
 *  swaps in the real content). A useEffect with empty deps would run before the
 *  element ever mounts and leave the observer unattached. A callback ref fires
 *  the moment React commits the element, so we always wire the observer to
 *  whichever node currently owns the ref.
 *
 *  Default `rootMargin: 200px` prefetches before the element actually appears,
 *  which is the right cadence for infinite-scroll. */
export function useIntersection(
  options: IntersectionObserverInit = { rootMargin: "200px" },
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const setRef = useCallback((node: Element | null) => {
    // Tear down any prior observation when the node changes.
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node && typeof IntersectionObserver !== "undefined") {
      const obs = new IntersectionObserver(
        ([entry]) => setIsIntersecting(entry.isIntersecting),
        optsRef.current,
      );
      obs.observe(node);
      observerRef.current = obs;
    } else {
      setIsIntersecting(false);
    }
  }, []);

  // Disconnect on unmount (parent removed entirely).
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return [setRef, isIntersecting] as const;
}
