/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../lib/i18n";
import { DetailedTarotReading } from "./DetailedTarotReading";
const reading = {
 signal_type: "opening" as const, overall_summary: "A short answer.",
 cards: [{card_name: "The Fool", position: "Signal", orientation: "upright" as const, meaning: "A simple meaning."}],
 final_action_advice: "Take one step.", follow_up_invitation: "What next?",
};
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({ matches: false, media, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("coalesces rapid taps and cancels a departed detail request without saving late content", async () => {
 let finish!: (value: Response) => void;
 const fetch = vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve; }));
 vi.stubGlobal("fetch", fetch);
 const onGenerated = vi.fn();
 const view = render(<LanguageProvider><DetailedTarotReading request={{question:"What next?",spreadType:"single",cards:[{cardId:"0-fool",name:"The Fool",orientation:"upright",position:"Signal"}],originalReading:reading}} onGenerated={onGenerated} /></LanguageProvider>);
 const button = screen.getByRole("button",{name:"Explore deeper · Free demo"});
 fireEvent.click(button);
 fireEvent.click(button);
 expect(fetch).toHaveBeenCalledOnce();
 expect((button as HTMLButtonElement).disabled).toBe(true);
 view.unmount();
 expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
 await act(async () => { finish(new Response(JSON.stringify({...reading,source:"api"}))); });
 expect(onGenerated).not.toHaveBeenCalled();
});

vi.mock("@/lib/api", () => ({ apiUrl: (path: string) => path, apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
