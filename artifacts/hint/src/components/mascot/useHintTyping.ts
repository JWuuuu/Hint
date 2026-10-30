import { useEffect, useRef, useState } from "react";

/** A saved draft is not an active keystroke. Settle when the reader pauses. */
export function useHintTyping(value: string) {
  const previous = useRef(value);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setTyping(Boolean(value.trim()));
    const timeout = setTimeout(() => setTyping(false), 1800);
    return () => clearTimeout(timeout);
  }, [value]);
  return typing;
}
