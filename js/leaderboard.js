// ========================================================
// LeaderboardManager - リーダーボード管理
// ========================================================
// ・同率スコア時: 先に登録したプレイヤーが1位、後から登録したプレイヤーが2位（登録日時昇順）
// ・管理者認証 (パスコード: 1827 / URLパラメータ: ?admin=1827) による個別削除保護
// ・Firebase Firestore クラウド連携対応（window.FIREBASE_CONFIG 設定時に自動稼働）

class LeaderboardManager {
    constructor() {
        this.storageKey = 'bpb_eggscalibur_leaderboard_v1';
        this.adminPasscode = (typeof window !== 'undefined' && window.ADMIN_PASSCODE) ? window.ADMIN_PASSCODE : '1827';
        this.records = this.loadRecords();
        this.listeners = [];
        this.firebaseDb = null;

        this.checkAdminInitial();
        this.initFirebase();
    }

    checkAdminInitial() {
        try {
            if (typeof window !== 'undefined' && window.location) {
                const params = new URLSearchParams(window.location.search);
                if (params.get('admin') === this.adminPasscode) {
                    localStorage.setItem('bpb_admin_pass', this.adminPasscode);
                }
            }
        } catch (e) {
            // URLパラメータ取得不可環境（エラー抑制）
        }
    }

    /**
     * 管理者認証状態の判定（URLパラメータまたは保存済みパスコード）
     */
    isAdmin() {
        try {
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                if (params.get('admin') === this.adminPasscode) return true;
                return localStorage.getItem('bpb_admin_pass') === this.adminPasscode;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    /**
     * パスコードによる管理者認証
     */
    setAdminPasscode(input) {
        if (input === this.adminPasscode) {
            localStorage.setItem('bpb_admin_pass', this.adminPasscode);
            this.notify();
            return true;
        }
        return false;
    }

    /**
     * 管理者ログアウト
     */
    logoutAdmin() {
        localStorage.removeItem('bpb_admin_pass');
        try {
            if (window.history && window.history.replaceState) {
                const url = new URL(window.location);
                if (url.searchParams.has('admin')) {
                    url.searchParams.delete('admin');
                    window.history.replaceState({}, '', url.toString());
                }
            }
        } catch (e) {}
        this.notify();
    }

    onChange(listener) {
        this.listeners.push(listener);
    }

    notify() {
        for (const l of this.listeners) l(this.records);
    }

    loadRecords() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const data = JSON.parse(raw);
                // 既存のレコードにもソートとタイムスタンプ整合性を適用
                for (const chId in data) {
                    if (Array.isArray(data[chId])) {
                        for (const entry of data[chId]) {
                            if (!entry.createdAt && entry.id) {
                                const parts = entry.id.split('_');
                                if (parts.length >= 2) {
                                    entry.createdAt = parseInt(parts[1], 10) || 0;
                                }
                            }
                        }
                    }
                }
                this.records = data;
                for (const chId in this.records) {
                    this.sortRecords(chId);
                }
                return this.records;
            }
        } catch (e) {
            console.warn('リーダーボードの読み込みエラー:', e);
        }
        return {}; // { challengeId: [ { id, name, heat, mana, staminaMisses, gridData, createdAt, timestamp } ] }
    }

    saveRecords() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.records));
        } catch (e) {
            console.error('リーダーボードの保存エラー:', e);
        }
    }

    /**
     * ランキングのソート
     * ルール: ヒート数降順 -> 空振りミス昇順 -> 登録日時昇順（同率スコアは先にいたプレイヤーが上位）
     */
    sortRecords(challengeId) {
        if (!this.records[challengeId]) return;

        const getTime = (entry) => {
            if (entry.createdAt) return entry.createdAt;
            if (entry.id) {
                const parts = entry.id.split('_');
                if (parts.length >= 2) {
                    const parsed = parseInt(parts[1], 10);
                    if (!isNaN(parsed)) return parsed;
                }
            }
            return 0;
        };

        this.records[challengeId].sort((a, b) => {
            // 1. ヒート数降順
            if (b.heat !== a.heat) return b.heat - a.heat;
            // 2. スタミナ空振りミス昇順（少ない方が上位）
            if (a.staminaMisses !== b.staminaMisses) return a.staminaMisses - b.staminaMisses;
            // 3. 同率スコア時: 先に登録したプレイヤーが1位、後から登録したプレイヤーが2位（登録日時昇順）
            const timeA = getTime(a);
            const timeB = getTime(b);
            if (timeA !== timeB) return timeA - timeB;
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * 新しいスコアを登録
     */
    addScore(challengeId, playerName, simResult, gridData) {
        if (!this.records[challengeId]) {
            this.records[challengeId] = [];
        }

        const now = Date.now();
        const entry = {
            id: 'score_' + now + '_' + Math.random().toString(36).substr(2, 4),
            playerName: playerName || '名無し職人',
            heat: simResult.finalHeat,
            mana: simResult.finalMana,
            staminaMisses: simResult.staminaMisses,
            totalBuffs: Object.values(simResult.buffs).reduce((a, b) => a + b, 0),
            gridData: JSON.parse(JSON.stringify(gridData)), // ディープコピー
            createdAt: now,
            timestamp: new Date().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };

        this.records[challengeId].push(entry);

        // ソート: ヒート数降順 -> 空振りミス昇順 -> 先着順
        this.sortRecords(challengeId);

        // 上位20件まで保持
        if (this.records[challengeId].length > 20) {
            this.records[challengeId] = this.records[challengeId].slice(0, 20);
        }

        this.saveRecords();

        // Firebase Firestore へ送信（設定されている場合）
        if (this.firebaseDb) {
            this.firebaseDb.collection('leaderboard').doc(challengeId).collection('scores').doc(entry.id).set(entry)
                .catch(err => console.error('Firestore 保存エラー:', err));
        }

        this.notify();
        return entry;
    }

    /**
     * スコアを個別削除 (管理者のみ実行可能)
     */
    deleteScore(challengeId, scoreId) {
        if (!this.isAdmin()) {
            alert('スコアの削除には管理者認証（パスコード: 1827）が必要です。');
            return false;
        }

        if (!this.records[challengeId]) return false;
        const initialLen = this.records[challengeId].length;
        this.records[challengeId] = this.records[challengeId].filter(e => e.id !== scoreId);
        
        if (this.records[challengeId].length !== initialLen) {
            this.saveRecords();

            // Firebase Firestore からも削除（設定されている場合）
            if (this.firebaseDb) {
                this.firebaseDb.collection('leaderboard').doc(challengeId).collection('scores').doc(scoreId).delete()
                    .catch(err => console.error('Firestore 削除エラー:', err));
            }

            this.notify();
            return true;
        }
        return false;
    }

    /**
     * 特定の設問のランキング取得
     */
    getRankings(challengeId) {
        return this.records[challengeId] || [];
    }

    /**
     * 1位のエントリを取得
     */
    getTopEntry(challengeId) {
        const list = this.getRankings(challengeId);
        return list.length > 0 ? list[0] : null;
    }

    /**
     * 特定の設問のスコア履歴をリセット
     */
    clearChallengeScores(challengeId) {
        delete this.records[challengeId];
        this.saveRecords();
        this.notify();
    }

    /**
     * Firebase Firestore 連携の初期化
     * window.FIREBASE_CONFIG.projectId が設定されていればクラウド同期を行う
     */
    initFirebase() {
        const config = window.FIREBASE_CONFIG;
        if (!config || !config.projectId) {
            // Firebase 未設定の場合はローカルストレージモード
            return;
        }

        const onSdkReady = () => {
            try {
                if (!window.firebase.apps.length) {
                    window.firebase.initializeApp(config);
                }
                this.firebaseDb = window.firebase.firestore();
                console.log('Firebase Firestore クラウドリーダーボードに接続しました');

                // 設問リストのリアルタイム購読
                ['free_all', 'bag_limit', 'custom_challenge'].forEach(chId => {
                    this.firebaseDb.collection('leaderboard').doc(chId).collection('scores')
                        .onSnapshot(snapshot => {
                            const scores = [];
                            snapshot.forEach(doc => {
                                scores.push(doc.data());
                            });
                            this.records[chId] = scores;
                            this.sortRecords(chId);
                            this.saveRecords();
                            this.notify();
                        }, err => {
                            console.warn(`Firestore 購読エラー (${chId}):`, err);
                        });
                });
            } catch (e) {
                console.warn('Firebase 初期化エラー:', e);
            }
        };

        if (typeof window.firebase === 'undefined') {
            const scriptApp = document.createElement('script');
            scriptApp.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js';
            scriptApp.onload = () => {
                const scriptFs = document.createElement('script');
                scriptFs.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js';
                scriptFs.onload = onSdkReady;
                document.head.appendChild(scriptFs);
            };
            document.head.appendChild(scriptApp);
        } else {
            onSdkReady();
        }
    }
}

// グローバルスコープにも公開 (クラシックスクリプト対応)
if (typeof window !== 'undefined') {
    window.LeaderboardManager = LeaderboardManager;
}
