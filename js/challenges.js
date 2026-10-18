const DEFAULT_CHALLENGES = [
    {
        id: 'pattern_1',
        name: 'パターン1: エッグス基礎検証（全解放盤面）',
        description: 'バッグなしの全63マスで、エッグスカリバー・トウガラシ・バナナ・マナオーブの基本シナジーとヒート速度を検証します。',
        mode: 'free',
        itemLimits: {
            eggscalibur: 1,
            chili: 8,
            banana: 4,
            cupcake: 2,
            mana_orb: 3
        },
        bagLimits: {
            leather_bag: 0,
            fanny_pack: 0,
            stamina_bag: 0
        }
    },
    {
        id: 'pattern_2',
        name: 'パターン2: バッグ構築・スタミナ制限チャレンジ',
        description: 'ウエストポーチとスタミナバッグを駆使し、限られたスペースでエッグスカリバーのCD短縮とスタミナを両立させる構成。',
        mode: 'bag',
        itemLimits: {
            eggscalibur: 1,
            chili: 6,
            banana: 3,
            cupcake: 3,
            mana_orb: 2
        },
        bagLimits: {
            leather_bag: 4,  // 革のカバン 4個 (2x2が4つ = 16マス)
            fanny_pack: 3,   // ウエストポーチ 3個 (2マスx3 = 6マス)
            stamina_bag: 2   // スタミナバッグ 2個 (3マスx2 = 6マス)
        }
    },
    {
        id: 'pattern_3',
        name: 'パターン3: マナオーブ特化・高速ヒート爆発',
        description: 'マナオーブを最大活用して35マナ到達（全バフ+3）を最速で狙い、ヒートを極限まで加速させるハイレベル構成。',
        mode: 'free',
        itemLimits: {
            eggscalibur: 2,
            chili: 10,
            banana: 6,
            cupcake: 4,
            mana_orb: 5
        },
        bagLimits: {
            leather_bag: 0,
            fanny_pack: 0,
            stamina_bag: 0
        }
    }
];

class ChallengeManager {
    constructor() {
        this.storageKey = 'bpb_eggscalibur_challenges_v1';
        this.activeChallengeId = 'pattern_1';
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
                    return parsed;
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
        this.activeChallengeId = 'pattern_1';
        this.saveChallenges();
        this.notify();
    }
}

// グローバルスコープにも公開 (クラシックスクリプト対応)
if (typeof window !== 'undefined') {
    window.DEFAULT_CHALLENGES = DEFAULT_CHALLENGES;
    window.ChallengeManager = ChallengeManager;
}

