/** @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { coverDecorations, decorationsCovered, useCoverDecorations, useDecorationsCovered } from "./decorationCover";

function Cover() { useCoverDecorations(); return null; }
function Probe({ seen }: { seen: boolean[] }) { seen.push(useDecorationsCovered()); return null; }

describe("decoration cover", () => {
  afterEach(cleanup);
  it("covers while any surface is open and releases each surface once", () => {
    expect(decorationsCovered()).toBe(false);
    const first = coverDecorations();
    const second = coverDecorations();
    first(); first();
    expect(decorationsCovered()).toBe(true);
    second();
    expect(decorationsCovered()).toBe(false);
  });

  it("follows a covering component's mount and unmount", () => {
    const seen: boolean[] = [];
    const view = render(<><Probe seen={seen} /></>);
    expect(seen.at(-1)).toBe(false);
    act(() => { view.rerender(<><Probe seen={seen} /><Cover /></>); });
    expect(seen.at(-1)).toBe(true);
    act(() => { view.rerender(<><Probe seen={seen} /></>); });
    expect(seen.at(-1)).toBe(false);
  });
});
