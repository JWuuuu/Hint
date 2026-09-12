// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AskHint } from "./AskHint";

const state = vi.hoisted(() => ({
  reduced: false,
  chat: { messages: [] as { id: string; role: "user"; content: string }[], isThinking: false },
}));
vi.mock("./useAskHintChat", () => ({ useAskHintChat: () => state.chat }));
vi.mock("./askHistory", () => ({ listAskHistory: () => [], subscribeToAskHistory: () => () => {} }));
vi.mock("../../lib/identity", () => ({ getAnonId: () => "scroll-fixture" }));
vi.mock("../../lib/i18n", () => ({ useLanguage: () => ({ t: (key: string) => key, language: "en" }) }));
vi.mock("../../lib/motionPolicy", () => ({ useMotionPolicy: () => ({ reduced: state.reduced, pageVisible: true }) }));
vi.mock("../hold/chat/components/FollowUpInput", () => ({ FollowUpInput: () => <textarea /> }));
vi.mock("../hold/chat/components/ChatMessage", () => ({ ChatMessage: ({ message }: { message: { content: string } }) => <p>{message.content}</p> }));

const scrollTo = vi.fn();
const previousScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
beforeEach(() => {
  state.reduced = false;
  state.chat = { messages: [], isThinking: false };
  scrollTo.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (previousScroll) Object.defineProperty(HTMLElement.prototype, "scrollTo", previousScroll);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
});

it("opens an empty invitation at the top and returns there after a conversation is cleared", () => {
  const view = render(<AskHint />);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "auto" });
  expect(view.container.querySelector(".hint-app-scroll")?.classList.contains("scroll-smooth")).toBe(false);
  state.chat.messages = [{ id: "question", role: "user", content: "A fictional question" }];
  view.rerender(<AskHint />);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 900, behavior: "smooth" });
  state.chat.messages = [];
  view.rerender(<AskHint />);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "auto" });
});

it("keeps new conversation activity at the bottom without smooth scrolling when motion is reduced", () => {
  state.reduced = true;
  state.chat.isThinking = true;
  const view = render(<AskHint />);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 900, behavior: "auto" });
  state.chat.isThinking = false;
  state.chat.messages = [{ id: "question", role: "user", content: "A fictional question" }];
  view.rerender(<AskHint />);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 900, behavior: "auto" });
});
