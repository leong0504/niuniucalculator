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

const TYPE_SCORE = {
  NO_BULL: 1,
  BULL: 2,
  BULL_BULL: 3,
  FOUR_FLOWER: 4,
  FIVE_FLOWER: 5,
  FIVE_SMALL: 6,
  BOMB: 7
};

const TYPE_NAME = {
  NO_BULL: "无牛",
  BULL: "有牛",
  BULL_BULL: "牛牛",
  FOUR_FLOWER: "四花牛",
  FIVE_FLOWER: "五花牛",
  FIVE_SMALL: "五小牛",
  BOMB: "炸弹"
};

Page({
  data: {
    ranks: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
    selectedCards: [],
    emptySlots: [1, 2, 3, 4, 5],
    flipIndex: -1,
    result: {
      typeName: "等待选牌",
      detail: "请选择 5 张牌"
    }
  },

  onPickRank(e) {
    const rank = e.currentTarget.dataset.rank;
    this.pushCard({
      rank,
      suit: "X",
      isSpadeA: false,
      label: rank
    });
  },

  onPickSpadeA() {
    this.pushCard({
      rank: "A",
      suit: "S",
      isSpadeA: true,
      label: "♠A"
    });
  },

  onUndo() {
    const selectedCards = [...this.data.selectedCards];
    if (!selectedCards.length) return;
    selectedCards.pop();
    this.updateState(selectedCards, -1);
  },

  onReset() {
    this.updateState([], -1);
  },

  pushCard(card) {
    let selectedCards = [...this.data.selectedCards];
    if (selectedCards.length >= 5) {
      selectedCards = [card];
    } else {
      selectedCards.push(card);
    }
    this.updateState(selectedCards, selectedCards.length - 1);
  },

  updateState(selectedCards, flipIndex = -1) {
    const emptySlots = Array.from({ length: 5 - selectedCards.length }, (_, i) => i + 1);
    const result =
      selectedCards.length === 5
        ? evaluateHand(selectedCards)
        : { typeName: "等待选牌", detail: "请选择 5 张牌" };
    this.setData({
      selectedCards,
      emptySlots,
      flipIndex,
      result
    });
  }
});

function evaluateHand(cards) {
  const rankList = cards.map((c) => c.rank);
  const values = cards.map((c) => RANK_VALUE_MAP[c.rank]);
  const maxCard = getMaxCard(cards);

  const hasNaturalBomb = hasFourOfAKind(rankList);
  const fiveSmall = isFiveSmall(values);
  const fiveFlower = isFiveFlower(rankList);
  const fourFlower = isFourFlower(rankList);

  const bullInfo = getBestBullInfo(cards);
  const specialBomb = bullInfo.hasBull && isSpecialSpadeABomb(cards, bullInfo.nonBullIdx);

  let type = "NO_BULL";
  let detail = "无法组成牛";

  if (hasNaturalBomb || specialBomb) {
    type = "BOMB";
    detail = hasNaturalBomb
      ? "命中自然炸弹：4张同点数"
      : `命中黑桃A特殊炸弹：${bullInfo.bullText}，后2张为花牌+♠A`;
  } else if (fiveSmall) {
    type = "FIVE_SMALL";
    detail = "5张都小于5且总和 <= 10";
  } else if (fiveFlower) {
    type = "FIVE_FLOWER";
    detail = "5张都是 J/Q/K";
  } else if (fourFlower) {
    type = "FOUR_FLOWER";
    detail = "4张是 J/Q/K";
  } else if (bullInfo.hasBull) {
    if (bullInfo.bullPoint === 0) {
      type = "BULL_BULL";
      detail = `成牛：${bullInfo.bullText}，后2张合计为10`;
    } else {
      type = "BULL";
      detail = `成牛：${bullInfo.bullText}，牛${bullInfo.bullPoint}`;
    }
  }

  let typeName = TYPE_NAME[type];
  if (type === "BULL") {
    typeName = formatBullName(bullInfo.bullPoint);
  }

  return {
    typeName,
    detail: `${detail}；最大牌：${maxCard}`
  };
}

function formatBullName(point) {
  const numMap = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (point >= 1 && point <= 9) return `牛${numMap[point]}`;
  return "有牛";
}

function getBestBullInfo(cards) {
  const n = cards.length;
  let best = {
    hasBull: false,
    bullPoint: -1,
    bullIdx: [],
    nonBullIdx: [],
    bullText: ""
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
        if (!best.hasBull || point > best.bullPoint) {
          const bullCardsText = bullIdx.map((idx) => cards[idx].label).join("+");
          const nonBullCardsText = nonBullIdx.map((idx) => cards[idx].label).join("+");
          const bullValuesText = matched.bullPickedValues.join("+");
          const nonBullValuesText = matched.nonBullPickedValues.join("+");
          best = {
            hasBull: true,
            bullPoint: point,
            bullIdx,
            nonBullIdx,
            bullText: `${bullCardsText}（按值 ${bullValuesText}）组成10倍数；剩余 ${nonBullCardsText}（按值 ${nonBullValuesText}）`
          };
        }
      }
    }
  }

  return best;
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
            if (point > bestPoint) {
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

function isSpecialSpadeABomb(cards, nonBullIdx) {
  if (!nonBullIdx || nonBullIdx.length !== 2) return false;
  const two = nonBullIdx.map((idx) => cards[idx]);
  const hasSpadeA = two.some((c) => c.isSpadeA);
  const hasFlower = two.some((c) => ["J", "Q", "K"].includes(c.rank));
  return hasSpadeA && hasFlower;
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
