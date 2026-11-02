// Backpack Battles - エッグスシミュ 更新履歴定義 (changelog.js)
// 管理画面（admin.html）から編集・エクスポートされた最新の更新履歴データです。

const DEFAULT_CHANGELOG = "【2026/11/02】\n・同時発動アイテムの仕様変更：配置順によるブレを完全撤廃し、上優先・左優先で発動するように統一\n・エッグスカリバーの★発動順：回転角度によらず、常に盤面の上優先・左優先で起動するように改修\n\n【2026/10/25】\n・設問「パターン2'」を追加\n・ブルーベリーを追加\n・ヘッダーに「更新履歴」ツールチップ表示機能を追加\n・登録時に同じ名前でより低いスコアがある場合、過去のものが削除されるように変更";

class ChangelogManager {
    constructor() {
        this.storageKey = 'bpb_eggscalibur_changelog_v1';
    }

    getChangelog() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved !== null && saved.trim() !== '') {
                return saved;
            }
        } catch (e) {
            console.warn('Failed to load changelog from localStorage:', e);
        }
        return DEFAULT_CHANGELOG;
    }

    saveChangelog(text) {
        try {
            localStorage.setItem(this.storageKey, text);
            return true;
        } catch (e) {
            console.error('Failed to save changelog to localStorage:', e);
            return false;
        }
    }

    resetToDefault() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {}
        return DEFAULT_CHANGELOG;
    }
}

if (typeof window !== 'undefined') {
    window.DEFAULT_CHANGELOG = DEFAULT_CHANGELOG;
    window.ChangelogManager = ChangelogManager;
}
