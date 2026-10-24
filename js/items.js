// Backpack Battles - エッグスカリバー特化 最適配置検証シミュレーター
// アイテムデータおよびバッグデータ定義

const ITEM_TYPES = {
    WEAPON: 'weapon',
    FOOD: 'food',
    ACCESSORY: 'accessory',
    BAG: 'bag'
};

// アイテムの形状定義（相対グリッド座標 [col, row]）
// 回転は右に90度: [col, row] -> [-row, col]（バウンディングボックス正規化あり）
const ITEMS = {
    // === 武器 ===
    eggscalibur: {
        id: 'eggscalibur',
        name: 'エッグスカリバー',
        type: ITEM_TYPES.WEAPON,
        rarity: 'legendary',
        icon: '🍳',
        description: '攻撃時、スタミナ1.3を消費。マナが11以上ある場合、11マナを消費して★にある全ての食べ物を即座に強制起動する（食べ物のクールダウン進捗はリセットされず維持）。スタミナ不足時は空振りしてCDリセット。',
        baseCooldown: 1.6,
        staminaCost: 1.3,
        manaCost: 11,
        // Sミノの4マス (横3x縦2: 上段右2マス + 下段左2マス)
        //    [■][■]  (1,0), (2,0)
        // [■][■]     (0,1), (1,1)
        shape: [
            [1, 0], [2, 0],
            [0, 1], [1, 1]
        ],
        // ★スロット: 隣接8箇所 + 先端の斜め位置2箇所（計10箇所）
        // 相対座標 [col, row]
        starSlots: [
            // 上段の上部および先端斜め (先端: 3,-1)
            [1, -1], [2, -1], [3, -1],
            // 上段の左右 (0,0 は下段の真上・上段の左隣接)
            [0, 0], [3, 0],
            // 下段の左右 (2,1 は上段の真下・下段の右隣接)
            [-1, 1], [2, 1],
            // 下段の下部および先端斜め (先端: -1,2)
            [-1, 2], [0, 2], [1, 2]
        ],
        color: '#f59e0b'
    },

    // === 食べ物 ===
    chili: {
        id: 'chili',
        name: 'トウガラシ',
        type: ITEM_TYPES.FOOD,
        rarity: 'rare',
        icon: '🌶️',
        description: '4.5秒ごとに1ヒートを獲得する。【食べ物共通】隣接（上下左右）する種類の違う食べ物1個につきCD+10%加速。',
        baseCooldown: 4.5,
        heatGain: 1,
        // 2マス (横2x縦1)
        shape: [
            [0, 0], [1, 0]
        ],
        starSlots: [],
        color: '#ef4444'
    },

    banana: {
        id: 'banana',
        name: 'バナナ',
        type: ITEM_TYPES.FOOD,
        rarity: 'common',
        icon: '🍌',
        description: '5.0秒ごとにスタミナを1回復する。【食べ物共通】隣接（上下左右）する種類の違う食べ物1個につきCD+10%加速。',
        baseCooldown: 5.0,
        staminaGain: 1,
        // 曲がった3マス (L字 2x2のうち3マス)
        // [■][■]  (0,0), (1,0)
        // [■]      (0,1)
        shape: [
            [0, 0], [1, 0],
            [0, 1]
        ],
        starSlots: [],
        color: '#eab308'
    },

    cupcake: {
        id: 'cupcake',
        name: 'カップケーキ',
        type: ITEM_TYPES.FOOD,
        rarity: 'rare',
        icon: '🧁',
        description: '6.0秒ごとに一番多いバフ2を獲得する（最多バフ同数時はマナ2獲得）。【食べ物共通】隣接（上下左右）する種類の違う食べ物1個につきCD+10%加速。',
        baseCooldown: 6.0,
        buffGainCount: 2,
        // 1マス
        shape: [
            [0, 0]
        ],
        starSlots: [],
        color: '#ec4899'
    },

    blueberry: {
        id: 'blueberry',
        name: 'ブルーベリー',
        type: ITEM_TYPES.FOOD,
        rarity: 'common',
        icon: '🫐',
        description: '3.5秒ごとにマナが9以下の場合は1マナ獲得し、マナが10以上の場合は1ラック獲得する。【食べ物共通】隣接（上下左右）する種類の違う食べ物1個につきCD+10%加速。',
        baseCooldown: 3.5,
        // 1マス (横1x縦1)
        shape: [
            [0, 0]
        ],
        starSlots: [],
        color: '#3b82f6'
    },

    // === アクセサリー ===
    mana_orb: {
        id: 'mana_orb',
        name: 'マナオーブ',
        type: ITEM_TYPES.ACCESSORY,
        rarity: 'epic',
        icon: '🔮',
        description: '★にあるアイテム発動時、2回に1回1マナを獲得。35マナ到達時、35マナを消費して全バフ+3を獲得（※この効果は1回のみ発動）。',
        baseCooldown: null, // パッシブ・トリガー発動
        manaThreshold: 35,
        thresholdBuffGain: 3,
        // 1マス
        shape: [
            [0, 0]
        ],
        // 斜め隣接4箇所の★スロット
        starSlots: [
            [-1, -1], [1, -1],
            [-1,  1], [1,  1]
        ],
        color: '#a855f7'
    },

    // === バッグタイル ===
    leather_bag: {
        id: 'leather_bag',
        name: '革のカバン',
        type: ITEM_TYPES.BAG,
        icon: '👜',
        spec: '特殊効果なし',
        description: '特殊効果なしの基本バッグ。',
        shape: [
            [0, 0], [1, 0],
            [0, 1], [1, 1]
        ],
        effect: null,
        color: '#e5c058' // 薄めの黄色 (light warm yellow)
    },

    fanny_pack: {
        id: 'fanny_pack',
        name: 'ウエストポーチ',
        type: ITEM_TYPES.BAG,
        icon: '👝',
        spec: '乗るアイテムのCD+10%',
        description: '乗っているアイテムのクールダウンが1マスにつき10%加速（速度+10%）。複数マスで重複。',
        // デフォルト横2x縦1
        shape: [
            [0, 0], [1, 0]
        ],
        cooldownSpeedBonusPerCell: 0.10, // +10% per cell
        color: '#8f3424' // 赤寄りの茶色 (reddish brown)
    },

    stamina_bag: {
        id: 'stamina_bag',
        name: 'スタミナバッグ',
        type: ITEM_TYPES.BAG,
        icon: '🧳',
        spec: 'スタミナ最大値+1',
        description: 'スタミナの最大値と初期値が+1。',
        // デフォルト縦3x横1 (横1x縦3)
        shape: [
            [0, 0],
            [0, 1],
            [0, 2]
        ],
        staminaMaxBonus: 1,
        color: '#38bdf8' // 淡めの青 (pale sky blue)
    }
};

// 座標リストを右に90度回転させて、左上(0,0)基準に正規化するユーティリティ
function rotateShape(coords) {
    // [x, y] -> [-y, x]
    const rotated = coords.map(([x, y]) => [-y, x]);
    // 最小のx, yを求めて左上オフセットを0にシフト
    const minX = Math.min(...rotated.map(([x]) => x));
    const minY = Math.min(...rotated.map(([, y]) => y));
    return rotated.map(([x, y]) => [x - minX, y - minY]);
}

// 形状と星スロットを同時に回転させ、本体の左上(0,0)に合わせて星スロットも平行移動する
function rotateItemWithStars(shape, starSlots) {
    const rotatedShape = shape.map(([x, y]) => [-y, x]);
    const rotatedStars = (starSlots || []).map(([x, y]) => [-y, x]);

    const minX = Math.min(...rotatedShape.map(([x]) => x));
    const minY = Math.min(...rotatedShape.map(([, y]) => y));

    const normShape = rotatedShape.map(([x, y]) => [x - minX, y - minY]);
    const normStars = rotatedStars.map(([x, y]) => [x - minX, y - minY]);

    return { shape: normShape, starSlots: normStars };
}

// 単体の星スロット回転（互換用）
function rotateStarSlots(starSlots, shapeRotationDeg = 90) {
    return starSlots.map(([x, y]) => [-y, x]);
}

// グローバルスコープにも公開 (クラシックスクリプト対応)
if (typeof window !== 'undefined') {
    window.ITEM_TYPES = ITEM_TYPES;
    window.ITEMS = ITEMS;
    window.rotateShape = rotateShape;
    window.rotateStarSlots = rotateStarSlots;
    window.rotateItemWithStars = rotateItemWithStars;
}

