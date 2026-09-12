import { forwardRef, useCallback, useEffect, useRef, useState, type ForwardedRef } from "react";
import { motion as framerMotion, type MotionProps } from "framer-motion";
import { useMotionPolicy } from "./motionPolicy";

/** Decorative Home effects keep their normal artwork, but do no repeated work offscreen. */
export function repeats(transition: unknown): boolean {
  return Boolean(transition && typeof transition === "object" && Object.entries(transition).some(([key, value]) =>
    key === "repeat" ? Number(value) > 0 : repeats(value)));
}
export function settledTarget(target: MotionProps["animate"]): MotionProps["animate"] {
  if (!target || typeof target !== "object" || Array.isArray(target) || "start" in target) return target;
  return Object.fromEntries(Object.entries(target).map(([key, value]) => [key,
    Array.isArray(value) ? value.findLast(item => item !== null) : value,
  ]));
}
function assignRef(ref: ForwardedRef<Element>, node: Element | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}
type DecorativeProps = MotionProps & Record<string, unknown>;
function quietComponent(tag: string) {
  const Component = framerMotion[tag as keyof typeof framerMotion] as React.ElementType;
  const Quiet = forwardRef<Element, DecorativeProps>((props, forwardedRef) => {
    const { reduced, pageVisible } = useMotionPolicy();
    const element = useRef<Element | null>(null);
    const [inView, setInView] = useState(true);
    const repeating = repeats(props.transition);
    const attach = useCallback((node: Element | null) => { element.current = node; assignRef(forwardedRef, node); }, [forwardedRef]);
    useEffect(() => {
      if (!repeating || !element.current || typeof IntersectionObserver === "undefined") return;
      const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { rootMargin: "48px" });
      observer.observe(element.current);
      return () => observer.disconnect();
    }, [repeating]);
    const quiet = reduced || !pageVisible || (repeating && !inView);
    return <Component {...props} ref={attach}
      initial={quiet ? false : props.initial}
      animate={quiet ? settledTarget((props.animate ?? props.whileInView) as MotionProps["animate"]) : props.animate}
      whileInView={quiet ? undefined : props.whileInView}
      whileHover={quiet ? undefined : props.whileHover}
      whileTap={quiet ? undefined : props.whileTap}
      transition={quiet ? { duration: 0, delay: 0, repeat: 0 } : props.transition}
    />;
  });
  Quiet.displayName = `QuietMotion(${tag})`;
  return Quiet;
}
const cache = new Map<string, ReturnType<typeof quietComponent>>();
export const motion = new Proxy({} as typeof framerMotion, {
  get(_target, tag: string) {
    if (!cache.has(tag)) cache.set(tag, quietComponent(tag));
    return cache.get(tag);
  },
});
