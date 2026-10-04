import type { HintLanguage } from "@/lib/i18n";
const copy = {
  en: {
    title: "Your cards, your choice",
    short: "A full deck. The choice is yours.",
    body: "All 78 cards are already in the deck. Once the shuffle is complete, their order stays fixed. You reveal the positions you choose; tapping does not generate a new card.",
    reduced:
      "Reduced motion is on. The same deck is prepared with shorter animations.",
  },
  zh: {
    title: "你的牌，由你选择",
    short: "完整的牌组，由你选择。",
    body: "78 张牌都已在牌组中。洗牌完成后，牌序便固定下来。你揭开的是自己选中的位置，点击时不会重新生成一张牌。",
    reduced: "已开启减少动态。牌组照常准备，动画会缩短。",
  },
  es: {
    title: "Tus cartas, tu elección",
    short: "La baraja está completa. Tú eliges.",
    body: "Las 78 cartas ya están en la baraja. Al terminar de barajar, el orden queda fijo. Revelas las posiciones que eliges; tocar no genera una carta nueva.",
    reduced:
      "El movimiento reducido está activado. La misma baraja se prepara con animaciones más breves.",
  },
  ja: {
    title: "カードを選ぶのは、あなた",
    short: "78枚のカード。選ぶのは、あなた。",
    body: "78枚のカードはすべてデッキに入っています。シャッフルが終わると順番が固定されます。選んだ位置のカードをめくるので、タップ時に新しいカードは生成されません。",
    reduced:
      "視差効果の軽減がオンです。同じデッキを短いアニメーションで準備します。",
  },
  ko: {
    title: "카드를 고르는 건 나",
    short: "완전한 덱에서 직접 골라요.",
    body: "78장 모두 이미 덱 안에 있어요. 섞기가 끝나면 순서가 고정돼요. 선택한 위치의 카드를 공개하며, 누를 때 새 카드를 만들지 않아요.",
    reduced:
      "동작 줄이기가 켜져 있어요. 같은 덱을 더 짧은 애니메이션으로 준비해요.",
  },
} as const;
export const ritualCopy = (language: HintLanguage) => copy[language];
