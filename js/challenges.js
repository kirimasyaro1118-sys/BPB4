// Backpack Battles - エッグスシミュ 設問・チャレンジ定義 (challenges.js)
// 管理画面（admin.html）から自動生成・エクスポートされた最新の設問データです。

const DEFAULT_CHALLENGES = [
    {
        "id": "p1",
        "name": "パターン1　大食無しパイロ",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 6,
            "banana": 2,
            "cupcake": 0,
            "blueberry": 0,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_2",
        "name": "パターン2　大食基本構成",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 4,
            "banana": 2,
            "cupcake": 2,
            "blueberry": 0,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_3",
        "name": "パターン3　バッグ加味",
        "description": "",
        "mode": "bag",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 4,
            "banana": 2,
            "cupcake": 2,
            "blueberry": 0,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 10,
            "fanny_pack": 4,
            "stamina_bag": 2
        }
    },
    {
        "id": "pattern_4",
        "name": "パターン4　トウガラシ多",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 8,
            "banana": 2,
            "cupcake": 0,
            "blueberry": 0,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_5",
        "name": "パターン5　カップケーキ多",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 2,
            "banana": 2,
            "cupcake": 6,
            "blueberry": 0,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_6",
        "name": "パターン6　マナオーブ3",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 4,
            "banana": 2,
            "cupcake": 4,
            "blueberry": 0,
            "mana_orb": 3
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_7",
        "name": "パターン7　マナオーブ4",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 4,
            "banana": 2,
            "cupcake": 4,
            "blueberry": 0,
            "mana_orb": 4
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_8",
        "name": "パターン8　エッグス2本",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 2,
            "chili": 10,
            "banana": 6,
            "cupcake": 0,
            "blueberry": 0,
            "mana_orb": 4
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_9",
        "name": "パターン1´　ブルーベリー追加",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 4,
            "banana": 2,
            "cupcake": 0,
            "blueberry": 4,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_10",
        "name": "パターン2'",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 2,
            "banana": 2,
            "cupcake": 2,
            "blueberry": 4,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_11",
        "name": "パターン3'",
        "description": "",
        "mode": "bag",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 2,
            "banana": 2,
            "cupcake": 2,
            "blueberry": 4,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 10,
            "fanny_pack": 4,
            "stamina_bag": 2
        }
    },
    {
        "id": "pattern_12",
        "name": "パターン4'",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 6,
            "banana": 2,
            "cupcake": 0,
            "blueberry": 4,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    },
    {
        "id": "pattern_13",
        "name": "パターン5'",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 2,
            "banana": 2,
            "cupcake": 4,
            "blueberry": 4,
            "mana_orb": 2
        },
        "bagLimits": {
            "leather_bag": 0,
            "fanny_pack": 0,
            "stamina_bag": 0
        }
    }
];

class ChallengeManager {
    constructor() {
        this.storageKey = 'bpb_eggscalibur_challenges_v1';
        this.activeChallengeId = 'p1';

        // 過去にブラウザに保存された古い設問データを完全に消去・クリーンアップ
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {}

        // 常に公式の最新設問（DEFAULT_CHALLENGES）のみを使用
        this.challenges = [...DEFAULT_CHALLENGES];
        this.listeners = [];
    }

    onChange(listener) {
        this.listeners.push(listener);
    }

    notify() {
        for (const l of this.listeners) l(this.getActiveChallenge());
    }

    loadChallenges() {
        // 過去の個人データは読み込まず、常に公式設問のみを返す
        return [...DEFAULT_CHALLENGES];
    }

    saveChallenges() {
        // 公式設問固定のため保存不要
    }

    getActiveChallenge() {
        return this.challenges.find(c => c.id === this.activeChallengeId) || this.challenges[0];
    }

    setActiveChallenge(id) {
        if (this.challenges.some(c => c.id === id)) {
            this.activeChallengeId = id;
            try {
                localStorage.setItem('bpb_eggscalibur_last_saved', id);
            } catch (e) {
                console.warn(e);
            }
            this.notify();
        }
    }

    addOrUpdateChallenge(challenge) {
        const idx = this.challenges.findIndex(c => c.id === challenge.id);
        if (idx >= 0) {
            this.challenges[idx] = challenge;
        } else {
            this.challenges.push(challenge);
        }
        this.saveChallenges();
        this.activeChallengeId = challenge.id;
        this.notify();
    }

    deleteChallenge(id) {
        if (this.challenges.length <= 1) return false;
        this.challenges = this.challenges.filter(c => c.id !== id);
        this.saveChallenges();
        if (this.activeChallengeId === id) {
            this.activeChallengeId = this.challenges[0].id;
        }
        this.notify();
        return true;
    }

    resetToDefaults() {
        this.challenges = [...DEFAULT_CHALLENGES];
        this.activeChallengeId = 'p1';
        this.saveChallenges();
        this.notify();
    }
}

// グローバルスコープにも公開 (クラシックスクリプト対応)
if (typeof window !== 'undefined') {
    window.DEFAULT_CHALLENGES = DEFAULT_CHALLENGES;
    window.ChallengeManager = ChallengeManager;
}
