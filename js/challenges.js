// Backpack Battles - エッグスシミュ 設問・チャレンジ定義 (challenges.js)
// 管理画面（admin.html）から自動生成・エクスポートされた最新の設問データです。

const DEFAULT_CHALLENGES = [
    {
        "id": "p1",
        "name": "パターン1",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 6,
            "banana": 2,
            "cupcake": 0,
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
        "name": "パターン2",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 4,
            "banana": 2,
            "cupcake": 2,
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
        "name": "パターン3",
        "description": "",
        "mode": "bag",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 4,
            "banana": 2,
            "cupcake": 2,
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
        "name": "パターン4",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 8,
            "banana": 2,
            "cupcake": 0,
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
        "name": "パターン5",
        "description": "",
        "mode": "free",
        "itemLimits": {
            "eggscalibur": 1,
            "chili": 2,
            "banana": 2,
            "cupcake": 6,
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
        this.challenges = this.loadChallenges();
        this.listeners = [];

        // 他タブでの更新をリアルタイム検知
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey && e.newValue) {
                try {
                    this.challenges = JSON.parse(e.newValue);
                    this.notify();
                } catch (err) {
                    console.warn('同期エラー:', err);
                }
            }
        });
    }

    onChange(listener) {
        this.listeners.push(listener);
    }

    notify() {
        for (const l of this.listeners) l(this.getActiveChallenge());
    }

    loadChallenges() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // 最新の公式設問（DEFAULT_CHALLENGES）にあって保存データにないものを自動合体
                    const merged = [...parsed];
                    let hasNew = false;
                    for (const defCh of DEFAULT_CHALLENGES) {
                        if (!merged.some(c => c.id === defCh.id)) {
                            merged.push(defCh);
                            hasNew = true;
                        }
                    }
                    if (hasNew) {
                        try {
                            localStorage.setItem(this.storageKey, JSON.stringify(merged));
                        } catch (e) {}
                    }
                    return merged;
                }
            }
        } catch (e) {
            console.warn('設問の読み込みエラー:', e);
        }
        return [...DEFAULT_CHALLENGES];
    }

    saveChallenges() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.challenges));
        } catch (e) {
            console.error('設問の保存エラー:', e);
        }
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
