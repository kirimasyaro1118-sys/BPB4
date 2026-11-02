// Backpack Battles - エッグスシミュ 更新履歴定義 (changelog.js)
// 管理画面（admin.html）から編集・エクスポートされた最新の更新履歴データです。

const DEFAULT_CHANGELOG = "【2026/11/02】\n・同時発動アイテムの発動順によって結果がブレる問題を解決：1つめに置いたブルーベリーと4つ目に置いたブルーベリーの位置を入れ替えるだけでシミュレーション結果が変わることがある問題がありました。上優先・左優先で発動するように統一することで、見た目の配置が同じなら結果が同じになるようにしました。これにより既存のリーダーボードのスコアは最大±10ほど増減しましたが各1位が交代することはありませんでした。\n・1位達成者限定のアイテム構成リクエスト機能を追加：歴代1位を更新するスコアを登録した際、追加・調整してほしいアイテム構成のリクエストを送信可能に\n・スマートフォン環境対応：PC推奨の案内ポップアップ、スマホ専用レイアウト、1位配置復元＆シミュレーション機能を整備（誤操作防止のため手動配置はオフ）\n・エッグスカリバーの★発動順：回転角度によらず、常に盤面の上優先・左優先で起動するように改修\n\n【2026/10/25】\n・ブルーベリーを追加\n・ヘッダーに「更新履歴」ツールチップ表示機能を追加\n・登録時に同じ名前でより低いスコアがある場合、過去のものが削除されるように変更";

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
