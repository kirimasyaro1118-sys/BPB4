// ========================================================
// LeaderboardManager - リーダーボード管理（世界リアルタイム同期対応・セキュリティ強化版）
// ========================================================
// ・同率スコア時: 先に登録したプレイヤーが1位、後から登録したプレイヤーが2位（登録日時昇順）
// ・管理者認証: SHA-256 ハッシュ照合による保護（平文非公開）
// ・Firebase Firestore クラウド連携対応（window.FIREBASE_CONFIG 設定時に世界同期自動稼働）

class LeaderboardManager {
    constructor() {
        this.storageKey = 'bpb_eggscalibur_leaderboard_v1';
        this.authStorageKey = 'bpb_admin_auth_hash_v2';

        // 管理者パスコードの SHA-256 ハッシュ値（平文パスコードはコード上に保持しない）
        this.adminHash = '7020e57625b6a6695ffd51ed494fbfc56c699eaceca4e77bf7ea590c7ebf3879';

        this.records = this.loadRecords();
        this.listeners = [];
        this.firebaseDb = null;

        // レートリミット（連投防止）用タイムスタンプ
        this.lastSubmitTime = 0;

        // クラウド同期ステータス ('local' | 'connecting' | 'connected' | 'error')
        this.cloudStatus = 'local';
        this.cloudErrorMessage = '';
        this.activeSubscriptions = new Set();
        this.pendingSubscriptions = new Set();

        this.cleanLegacyStorageAndUrl();
        this.initFirebase();
    }

    /**
     * 旧バージョンの平文認証情報およびURLパラメータの安全な消去
     */
    cleanLegacyStorageAndUrl() {
        try {
            // 旧バージョンの平文パスコードストレージを安全に破棄
            localStorage.removeItem('bpb_admin_pass');

            // URLパラメータ ?admin= が万一付加されていた場合は即時消去（URL共有や履歴からの漏洩防止）
            if (typeof window !== 'undefined' && window.location && window.history && window.history.replaceState) {
                const url = new URL(window.location);
                if (url.searchParams.has('admin')) {
                    url.searchParams.delete('admin');
                    window.history.replaceState({}, '', url.toString());
                }
            }
        } catch (e) {
            // エラー抑制
        }
    }

    /**
     * 文字列の SHA-256 ハッシュ値を計算 (Web Crypto API)
     */
    async computeHash(text) {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(text);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                console.warn('Web Crypto hash error:', e);
            }
        }
        return '';
    }

    /**
     * 管理者認証状態の判定（保存済みハッシュとの照合）
     */
    isAdmin() {
        try {
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(this.authStorageKey) === this.adminHash;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    /**
     * パスコードによる管理者認証 (SHA-256 ハッシュ照合)
     */
    async setAdminPasscode(input) {
        if (!input || typeof input !== 'string') return false;
        const hash = await this.computeHash(input.trim());
        if (hash === this.adminHash) {
            try {
                localStorage.setItem(this.authStorageKey, this.adminHash);
            } catch (e) {}
            this.notify();
            return true;
        }
        return false;
    }

    /**
     * 管理者ログアウト
     */
    logoutAdmin() {
        try {
            localStorage.removeItem(this.authStorageKey);
            localStorage.removeItem('bpb_admin_pass');
        } catch (e) {}
        this.notify();
    }

    onChange(listener) {
        this.listeners.push(listener);
    }

    notify() {
        for (const l of this.listeners) {
            try {
                l(this.records, this.getCloudStatus());
            } catch (err) {
                console.error('Leaderboard listener error:', err);
            }
        }
    }

    getCloudStatus() {
        return {
            status: this.cloudStatus,
            message: this.cloudErrorMessage,
            isConnected: this.cloudStatus === 'connected',
            isConfigured: !!(typeof window !== 'undefined' && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId)
        };
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
        return {}; // { challengeId: [ { id, playerName, heat, mana, staminaMisses, gridData, createdAt, timestamp } ] }
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
            return (a.id || '').localeCompare(b.id || '');
        });
    }

    /**
     * 指定された設問のFirestoreリアルタイム購読を開始
     */
    subscribeChallenge(challengeId) {
        if (!challengeId) return;

        if (!this.firebaseDb) {
            this.pendingSubscriptions.add(challengeId);
            return;
        }

        if (this.activeSubscriptions.has(challengeId)) {
            return;
        }

        this.activeSubscriptions.add(challengeId);

        try {
            this.firebaseDb.collection('leaderboard').doc(challengeId).collection('scores')
                .onSnapshot(snapshot => {
                    const scores = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data && (data.heat !== undefined || data.id)) {
                            scores.push(data);
                        }
                    });

                    this.records[challengeId] = scores;
                    this.sortRecords(challengeId);

                    // 上位20件
                    if (this.records[challengeId].length > 20) {
                        this.records[challengeId] = this.records[challengeId].slice(0, 20);
                    }

                    this.saveRecords();
                    this.notify();
                }, err => {
                    console.warn(`[Firestore] 購読エラー (${challengeId}):`, err);
                    if (err.code === 'permission-denied') {
                        this.cloudStatus = 'error';
                        this.cloudErrorMessage = 'セキュリティルールによりアクセスが拒否されました。';
                        this.notify();
                    }
                });
        } catch (e) {
            console.warn(`[Firestore] 購読初期化例外 (${challengeId}):`, e);
        }
    }

    /**
     * 新しいスコアを登録（上限なし・自由なスコア登録対応）
     */
    addScore(challengeId, playerName, simResult, gridData) {
        if (!challengeId || !simResult) return null;

        // 1. 連投防止レートリミット（3秒以内の連打防止）
        const now = Date.now();
        if (now - this.lastSubmitTime < 3000) {
            alert('スコア登録の間隔が短すぎます。数秒お待ちください。');
            return null;
        }
        this.lastSubmitTime = now;

        // 2. スコア値の取得（上限なし）
        const heat = typeof simResult.finalHeat === 'number' ? simResult.finalHeat : (Number(simResult.finalHeat) || 0);

        // 3. プレイヤー名のサニタイズ（制御文字除去、最大12文字）
        let safeName = String(playerName || '名無し職人').trim().replace(/[\x00-\x1F\x7F]/g, '');
        if (safeName.length > 12) safeName = safeName.substring(0, 12);
        if (!safeName) safeName = '名無し職人';

        // 4. gridData のサイズ検証（巨大ペイロードによるDoS防止）
        let safeGrid = null;
        try {
            const serialized = JSON.stringify(gridData);
            if (serialized.length > 30000) {
                alert('配置データのサイズが大きすぎます。');
                return null;
            }
            safeGrid = JSON.parse(serialized);
        } catch (e) {
            safeGrid = {};
        }

        if (!this.records[challengeId]) {
            this.records[challengeId] = [];
        }

        const currentRecords = this.records[challengeId];

        // 5. 同名プレイヤーの既存スコアを検索
        const sameNameEntries = currentRecords.filter(r => r.playerName === safeName);
        let isUpdate = false;
        let oldHeat = null;

        if (sameNameEntries.length > 0) {
            // 最も高い既存スコアを判定
            const bestExisting = sameNameEntries.reduce((max, r) => (r.heat > max.heat ? r : max), sameNameEntries[0]);

            // 新しいスコアが既存スコア以下（同等またはそれ以下）の場合は自己ベストを維持して登録スキップ
            if (heat <= bestExisting.heat) {
                return {
                    success: false,
                    reason: 'lower_or_equal',
                    currentBest: bestExisting.heat,
                    newHeat: heat
                };
            }

            // 新しいスコアの方が高い場合: より低い既存スコアを削除対象に指定
            isUpdate = true;
            oldHeat = bestExisting.heat;

            const idsToDelete = sameNameEntries.filter(r => r.heat < heat).map(r => r.id);

            // ローカルから古いスコアを削除
            this.records[challengeId] = currentRecords.filter(r => !idsToDelete.includes(r.id));

            // Firestore からも古いスコアを削除（設定されている場合）
            if (this.firebaseDb) {
                idsToDelete.forEach(id => {
                    this.firebaseDb.collection('leaderboard').doc(challengeId).collection('scores').doc(id).delete()
                        .then(() => {
                            console.log(`[Firestore] 低いスコアを上書き削除しました: ${id} (${safeName})`);
                        })
                        .catch(err => console.warn(`[Firestore] 古いスコア削除失敗:`, err));
                });
            }
        }

        const entry = {
            id: 'score_' + now + '_' + Math.random().toString(36).substr(2, 6),
            playerName: safeName,
            heat: heat,
            mana: Math.max(0, Number(simResult.finalMana) || 0),
            staminaMisses: Math.max(0, Number(simResult.staminaMisses) || 0),
            totalBuffs: Object.values(simResult.buffs || {}).reduce((a, b) => a + (Number(b) || 0), 0),
            gridData: safeGrid,
            createdAt: now,
            timestamp: new Date().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };

        // ローカルに新スコアを追加
        this.records[challengeId].push(entry);
        this.sortRecords(challengeId);
        if (this.records[challengeId].length > 20) {
            this.records[challengeId] = this.records[challengeId].slice(0, 20);
        }
        this.saveRecords();

        // Firebase Firestore へ送信（設定されている場合）
        if (this.firebaseDb) {
            this.firebaseDb.collection('leaderboard').doc(challengeId).collection('scores').doc(entry.id).set(entry)
                .then(() => {
                    console.log(`[Firestore] スコアを世界共有サーバーに登録しました: ${entry.playerName} (ヒート: ${entry.heat})`);
                })
                .catch(err => {
                    console.error('[Firestore] スコア保存エラー:', err);
                    if (err.code === 'permission-denied') {
                        alert('【Firestore接続エラー】セキュリティルールにより保存が拒否されました。\nFirebase Consoleでルールを確認してください。');
                    }
                });
        }

        // 未購読であれば購読開始
        this.subscribeChallenge(challengeId);

        this.notify();
        return {
            success: true,
            isUpdate,
            oldHeat,
            entry
        };
    }

    /**
     * スコアを個別削除 (管理者のみ実行可能)
     */
    deleteScore(challengeId, scoreId) {
        if (!this.isAdmin()) {
            alert('スコアの削除には管理者認証が必要です。');
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
                    .then(() => {
                        console.log(`[Firestore] スコアを削除しました: ${scoreId}`);
                    })
                    .catch(err => console.error('[Firestore] スコア削除エラー:', err));
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
        if (!this.activeSubscriptions.has(challengeId)) {
            this.subscribeChallenge(challengeId);
        }
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
        if (!this.isAdmin()) {
            alert('リセットには管理者認証が必要です。');
            return false;
        }

        const entriesToDelete = [...(this.records[challengeId] || [])];
        delete this.records[challengeId];
        this.saveRecords();

        if (this.firebaseDb && entriesToDelete.length > 0) {
            entriesToDelete.forEach(entry => {
                if (entry.id) {
                    this.firebaseDb.collection('leaderboard').doc(challengeId).collection('scores').doc(entry.id).delete()
                        .catch(err => console.error('[Firestore] リセット削除エラー:', err));
                }
            });
        }

        this.notify();
        return true;
    }

    /**
     * 既知の全設問IDをFirestoreリアルタイム購読
     */
    subscribeAllKnownChallenges() {
        const ids = new Set();

        // 1. コード内の既知ID
        if (typeof window !== 'undefined' && window.DEFAULT_CHALLENGES) {
            window.DEFAULT_CHALLENGES.forEach(c => ids.add(c.id));
        }
        ['p1', 'pattern_2', 'pattern_3', 'free_all', 'bag_limit', 'custom_challenge'].forEach(id => ids.add(id));

        // 2. ローカルストレージに保存されている設問ID
        try {
            const rawChallenges = localStorage.getItem('bpb_eggscalibur_challenges_v1');
            if (rawChallenges) {
                const list = JSON.parse(rawChallenges);
                if (Array.isArray(list)) list.forEach(c => c.id && ids.add(c.id));
            }
        } catch (e) {}

        // 3. 現在のローカルスコアレコードの全キー
        Object.keys(this.records).forEach(id => ids.add(id));

        // 4. 保留中の購読ID
        this.pendingSubscriptions.forEach(id => ids.add(id));
        this.pendingSubscriptions.clear();

        // 購読実行
        ids.forEach(chId => this.subscribeChallenge(chId));
    }

    /**
     * Firebase Firestore 連携の初期化
     */
    initFirebase() {
        const config = (typeof window !== 'undefined') ? window.FIREBASE_CONFIG : null;
        if (!config || !config.projectId) {
            this.cloudStatus = 'local';
            return;
        }

        this.cloudStatus = 'connecting';

        const onSdkReady = () => {
            try {
                if (!window.firebase.apps || !window.firebase.apps.length) {
                    window.firebase.initializeApp(config);
                }
                this.firebaseDb = window.firebase.firestore();
                this.cloudStatus = 'connected';
                this.cloudErrorMessage = '';
                console.log('🌐 Firebase Firestore クラウドリーダーボードに接続しました！');

                // 既知のすべての設問のリアルタイム購読を開始
                this.subscribeAllKnownChallenges();

                this.notify();
            } catch (e) {
                console.warn('Firebase 初期化エラー:', e);
                this.cloudStatus = 'error';
                this.cloudErrorMessage = e.message || '初期化に失敗しました';
                this.notify();
            }
        };

        if (typeof window.firebase === 'undefined' || typeof window.firebase.firestore === 'undefined') {
            const scriptApp = document.createElement('script');
            scriptApp.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js';
            scriptApp.onload = () => {
                const scriptFs = document.createElement('script');
                scriptFs.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js';
                scriptFs.onload = onSdkReady;
                scriptFs.onerror = () => {
                    this.cloudStatus = 'error';
                    this.cloudErrorMessage = 'Firebase Firestore SDKの読み込みに失敗しました。';
                    this.notify();
                };
                document.head.appendChild(scriptFs);
            };
            scriptApp.onerror = () => {
                this.cloudStatus = 'error';
                this.cloudErrorMessage = 'Firebase SDKの読み込みに失敗しました。';
                this.notify();
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
