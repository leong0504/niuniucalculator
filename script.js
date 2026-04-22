const RANK_VALUE_MAP = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10
};

const TYPE_NAME = {
  NO_BULL: "無牛",
  BULL: "有牛",
  BULL_BULL: "牛牛",
  PAIR: "對子",
  FOUR_FLOWER: "四花牛",
  FIVE_FLOWER: "五花牛",
  FIVE_SMALL: "五小牛",
  BOMB: "炸彈"
};

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const state = {
  selectedCards: [],
  flipIndex: -1,
  highlightIndices: [],
  result: {
    typeName: "等待選牌",
    detail: ""
  }
};

const cardsEl = document.getElementById("cards");
const keyboardEl = document.getElementById("keyboard");
const resultTypeEl = document.getElementById("resultType");
const resultDetailEl = document.getElementById("resultDetail");
const pickedCountEl = document.getElementById("pickedCount");
const rulesBtnEl = document.getElementById("rulesBtn");
const rulesOverlayEl = document.getElementById("rulesOverlay");
const rulesCloseEl = document.getElementById("rulesClose");

function init() {
  initRulesDialog();
  renderKeyboard();
  render();
}

function initRulesDialog() {
  if (!rulesBtnEl || !rulesOverlayEl || !rulesCloseEl) return;

  const open = () => {
    rulesOverlayEl.hidden = false;
  };
  const close = () => {
    rulesOverlayEl.hidden = true;
  };

  rulesBtnEl.addEventListener("click", open);
  rulesCloseEl.addEventListener("click", close);

  rulesOverlayEl.addEventListener("click", (e) => {
    if (e.target === rulesOverlayEl) close();
  });

  window.addEventListener("keydown", (e) => {
    if (!rulesOverlayEl.hidden && e.key === "Escape") close();
  });
}

function renderKeyboard() {
  const frag = document.createDocumentFragment();
  ranks.forEach((rank) => {
    const btn = createKey(rank, () =>
      pushCard({ rank, suit: "X", isSpadeA: false, label: rank })
    );
    frag.appendChild(btn);
  });
  frag.appendChild(createKey("♠A", () => pushCard({ rank: "A", suit: "S", isSpadeA: true, label: "♠A" })));
  frag.appendChild(createKey("←", onUndo, "action"));
  frag.appendChild(createKey("↻", onReset, "action"));
  keyboardEl.appendChild(frag);
}

function createKey(text, onClick, extraClass = "") {
  const btn = document.createElement("button");
  btn.className = `key ${extraClass}`.trim();
  btn.type = "button";
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

function onUndo() {
  if (!state.selectedCards.length) return;
  const selectedCards = [...state.selectedCards];
  selectedCards.pop();
  updateState(selectedCards, -1);
}

function onReset() {
  updateState([], -1);
}

function pushCard(card) {
  let selectedCards = [...state.selectedCards];
  if (selectedCards.length >= 5) {
    selectedCards = [card];
  } else {
    selectedCards.push(card);
  }
  updateState(selectedCards, selectedCards.length - 1);
}

function updateState(selectedCards, flipIndex = -1) {
  state.selectedCards = selectedCards;
  state.flipIndex = flipIndex;
  state.result =
    selectedCards.length === 5
      ? evaluateHand(selectedCards)
      : { typeName: "等待選牌", detail: "" };
  state.highlightIndices = selectedCards.length === 5 && state.result.bullIdx ? state.result.bullIdx : [];
  render();
}

function render() {
  cardsEl.innerHTML = "";

  state.selectedCards.forEach((card, idx) => {
    const cardEl = document.createElement("div");
    cardEl.className = `card ${idx === state.flipIndex ? "card-flip-in" : ""} ${
      state.highlightIndices.includes(idx) ? "bull-group" : ""
    }`.trim();
    if (card.label.length >= 2) {
      cardEl.classList.add("card-wide-text");
    }
    const front = document.createElement("div");
    front.className = "card-front";
    const text = document.createElement("span");
    text.textContent = card.label;
    front.appendChild(text);
    cardEl.appendChild(front);
    cardsEl.appendChild(cardEl);
  });

  for (let i = state.selectedCards.length; i < 5; i += 1) {
    const empty = document.createElement("div");
    empty.className = "card empty";
    empty.innerHTML = `
      <div class="card-back">
        <img src="./miniprogram/assets/card-back.png" alt="card back" />
      </div>
    `;
    cardsEl.appendChild(empty);
  }

  resultTypeEl.textContent = state.result.typeName;
  resultDetailEl.textContent = state.result.detail || "";
  pickedCountEl.textContent = String(state.selectedCards.length);
}

function evaluateHand(cards) {
  const rankList = cards.map((c) => c.rank);
  const values = cards.map((c) => RANK_VALUE_MAP[c.rank]);
  const maxCard = getMaxCard(cards);

  const hasNaturalBomb = hasFourOfAKind(rankList);
  const fiveSmall = isFiveSmall(values);
  const fiveFlower = isFiveFlower(rankList);
  const fourFlower = isFourFlower(rankList);

  const bullInfo = getBestBullInfo(cards);
  const specialBomb = bullInfo.specialBomb;

  let type = "NO_BULL";
  let detail = "無法組成牛";
  let bullIdx = [];

  if (hasNaturalBomb || specialBomb) {
    type = "BOMB";
    detail = hasNaturalBomb ? "命中自然炸彈" : "命中黑桃 A 特殊炸彈";
    bullIdx = specialBomb ? bullInfo.specialBullIdx : bullInfo.hasBull ? bullInfo.bullIdx : [];
  } else if (fiveSmall) {
    type = "FIVE_SMALL";
    detail = "5 張都小於 5 且總和 <= 10";
  } else if (fiveFlower) {
    type = "FIVE_FLOWER";
    detail = "5 張都是 J/Q/K";
  } else if (fourFlower) {
    type = "FOUR_FLOWER";
    detail = "4 張是 J/Q/K";
  } else if (bullInfo.hasBull) {
    if (bullInfo.pairHand) {
      bullIdx = bullInfo.pairBullIdx;
      type = "PAIR";
      detail = "命中對子";
    } else if (bullInfo.bullPoint === 0) {
      bullIdx = bullInfo.bullIdx;
      type = "BULL_BULL";
      detail = "後 2 張合計為 10";
    } else {
      bullIdx = bullInfo.bullIdx;
      type = "BULL";
      detail = `牛${bullInfo.bullPoint}`;
    }
  }

  let typeName = TYPE_NAME[type];
  if (type === "BULL") {
    typeName = formatBullName(bullInfo.bullPoint);
  }

  return {
    typeName,
    detail: "",
    bullIdx
  };
}

function formatBullName(point) {
  const numMap = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (point >= 1 && point <= 9) return `牛${numMap[point]}`;
  return "有牛";
}

function getBestBullInfo(cards) {
  const n = cards.length;
  const preferNormalAInBull = hasSpadeAAndNormalA(cards);
  let best = {
    hasBull: false,
    bullPoint: -1,
    bullIdx: [],
    nonBullIdx: [],
    bullText: "",
    specialBombCandidate: false
  };
  let bestSpecial = {
    ok: false,
    point: -1,
    bullIdx: [],
    nonBullIdx: []
  };
  let bestPair = {
    ok: false,
    point: -1,
    bullIdx: [],
    nonBullIdx: []
  };

  for (let i = 0; i < n - 2; i += 1) {
    for (let j = i + 1; j < n - 1; j += 1) {
      for (let k = j + 1; k < n; k += 1) {
        const bullIdx = [i, j, k];
        const nonBullIdx = [];
        for (let t = 0; t < n; t += 1) {
          if (!bullIdx.includes(t)) nonBullIdx.push(t);
        }

        const bullValueList = bullIdx.map((idx) => getValuesWithSwap(cards[idx].rank));
        const nonBullValueList = nonBullIdx.map((idx) => getValuesWithSwap(cards[idx].rank));
        const matched = searchBullMatch(bullValueList, nonBullValueList);

        if (!matched.ok) continue;
        const point = matched.point;
        const nonBullTwo = nonBullIdx.map((idx) => cards[idx]);
        const specialBombCandidate =
          nonBullTwo.length === 2 &&
          nonBullTwo.some((c) => c.isSpadeA) &&
          nonBullTwo.some((c) => ["J", "Q", "K"].includes(c.rank));
        const pairCandidate =
          nonBullTwo.length === 2 &&
          nonBullTwo[0].rank === nonBullTwo[1].rank;

        const normalAInBull = bullIdx.some((idx) => cards[idx].rank === "A" && !cards[idx].isSpadeA);
        const bestSpecialNormalAInBull = bestSpecial.ok
          ? bestSpecial.bullIdx.some((idx) => cards[idx].rank === "A" && !cards[idx].isSpadeA)
          : false;
        if (
          specialBombCandidate &&
          (
            !bestSpecial.ok ||
            getBullScore(point) > getBullScore(bestSpecial.point) ||
            (getBullScore(point) === getBullScore(bestSpecial.point) &&
              preferNormalAInBull &&
              normalAInBull &&
              !bestSpecialNormalAInBull)
          )
        ) {
          bestSpecial = {
            ok: true,
            point,
            bullIdx,
            nonBullIdx
          };
        }
        const bestPairNormalAInBull = bestPair.ok
          ? bestPair.bullIdx.some((idx) => cards[idx].rank === "A" && !cards[idx].isSpadeA)
          : false;
        if (
          pairCandidate &&
          (
            !bestPair.ok ||
            getBullScore(point) > getBullScore(bestPair.point) ||
            (getBullScore(point) === getBullScore(bestPair.point) &&
              preferNormalAInBull &&
              normalAInBull &&
              !bestPairNormalAInBull)
          )
        ) {
          bestPair = {
            ok: true,
            point,
            bullIdx,
            nonBullIdx
          };
        }

        const bestNormalAInBull = best.hasBull
          ? best.bullIdx.some((idx) => cards[idx].rank === "A" && !cards[idx].isSpadeA)
          : false;
        if (
          !best.hasBull ||
          getBullScore(point) > getBullScore(best.bullPoint) ||
          (point === best.bullPoint && specialBombCandidate && !best.specialBombCandidate) ||
          (getBullScore(point) === getBullScore(best.bullPoint) &&
            specialBombCandidate === best.specialBombCandidate &&
            preferNormalAInBull &&
            normalAInBull &&
            !bestNormalAInBull)
        ) {
          const bullCardsText = bullIdx.map((idx) => cards[idx].label).join("+");
          const nonBullCardsText = nonBullIdx.map((idx) => cards[idx].label).join("+");
          const bullValuesText = matched.bullPickedValues.join("+");
          const nonBullValuesText = matched.nonBullPickedValues.join("+");
          best = {
            hasBull: true,
            bullPoint: point,
            bullIdx,
            nonBullIdx,
            bullText: `${bullCardsText}（按值 ${bullValuesText}）組成 10 倍數；剩餘 ${nonBullCardsText}（按值 ${nonBullValuesText}）`,
            specialBombCandidate
          };
        }
      }
    }
  }

  return {
    ...best,
    specialBomb: bestSpecial.ok,
    specialBullIdx: bestSpecial.ok ? bestSpecial.bullIdx : [],
    specialNonBullIdx: bestSpecial.ok ? bestSpecial.nonBullIdx : [],
    pairHand: bestPair.ok,
    pairBullIdx: bestPair.ok ? bestPair.bullIdx : [],
    pairNonBullIdx: bestPair.ok ? bestPair.nonBullIdx : []
  };
}

function searchBullMatch(bullValueList, nonBullValueList) {
  let hasMatch = false;
  let bestPoint = -1;
  let bestBullPickedValues = [];
  let bestNonBullPickedValues = [];

  for (let a = 0; a < bullValueList[0].length; a += 1) {
    for (let b = 0; b < bullValueList[1].length; b += 1) {
      for (let c = 0; c < bullValueList[2].length; c += 1) {
        const sum3 = bullValueList[0][a] + bullValueList[1][b] + bullValueList[2][c];
        if (sum3 % 10 !== 0) continue;
        for (let d = 0; d < nonBullValueList[0].length; d += 1) {
          for (let e = 0; e < nonBullValueList[1].length; e += 1) {
            const sum2 = nonBullValueList[0][d] + nonBullValueList[1][e];
            const point = sum2 % 10;
            hasMatch = true;
            if (getBullScore(point) > getBullScore(bestPoint)) {
              bestPoint = point;
              bestBullPickedValues = [bullValueList[0][a], bullValueList[1][b], bullValueList[2][c]];
              bestNonBullPickedValues = [nonBullValueList[0][d], nonBullValueList[1][e]];
            }
          }
        }
      }
    }
  }
  return hasMatch
    ? {
        ok: true,
        point: bestPoint,
        bullPickedValues: bestBullPickedValues,
        nonBullPickedValues: bestNonBullPickedValues
      }
    : { ok: false, point: -1, bullPickedValues: [], nonBullPickedValues: [] };
}

function getBullScore(point) {
  if (point < 0) return -1;
  return point === 0 ? 10 : point;
}

function hasSpadeAAndNormalA(cards) {
  const hasSpadeA = cards.some((c) => c.rank === "A" && c.isSpadeA);
  const hasNormalA = cards.some((c) => c.rank === "A" && !c.isSpadeA);
  return hasSpadeA && hasNormalA;
}

function getValuesWithSwap(rank) {
  if (rank === "3") return [3, 6];
  if (rank === "6") return [6, 3];
  return [RANK_VALUE_MAP[rank]];
}

function hasFourOfAKind(rankList) {
  const countMap = {};
  rankList.forEach((r) => {
    countMap[r] = (countMap[r] || 0) + 1;
  });
  return Object.values(countMap).some((v) => v >= 4);
}

function isFiveSmall(values) {
  const everySmall = values.every((v) => v < 5);
  const total = values.reduce((sum, v) => sum + v, 0);
  return everySmall && total <= 10;
}

function isFiveFlower(rankList) {
  return rankList.every((r) => ["J", "Q", "K"].includes(r));
}

function isFourFlower(rankList) {
  const flowerCount = rankList.filter((r) => ["J", "Q", "K"].includes(r)).length;
  return flowerCount >= 4;
}

function getMaxCard(cards) {
  const suitScore = {
    S: 4,
    H: 3,
    C: 2,
    D: 1,
    X: 0
  };
  const rankScore = {
    A: 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13
  };

  const sorted = [...cards].sort((a, b) => {
    if (rankScore[a.rank] !== rankScore[b.rank]) {
      return rankScore[b.rank] - rankScore[a.rank];
    }
    return suitScore[b.suit] - suitScore[a.suit];
  });

  return sorted[0].label;
}

init();
