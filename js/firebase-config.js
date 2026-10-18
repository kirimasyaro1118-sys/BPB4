// ========================================================
// Firebase クラウドリーダーボード設定 (世界ランキング同期)
// ========================================================
// 【世界中のプレイヤーとランキングを共有・公開する手順】
// 1. Firebase Console (https://console.firebase.google.com/) にアクセスし、「プロジェクトを追加」（無料SparkプランでOK）
// 2. 左メニュー「構築」→「Firestore Database」を作成（「テストモードで開始」推奨、ロケーションは asia-northeast1 等）
// 3. プロジェクト設定の「マイアプリ」から「ウェブ（</>）」を追加
// 4. 発行された firebaseConfig の内容を以下の各項目に貼り付けて保存してください。
//
// ※ projectId が空（""）の間は、個人ブラウザの localStorage（ローカル保存）で安全に動作します。
// ※ 設定を入力して保存・公開すると、即座に世界リアルタイム同期が有効化されます。

window.FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// 管理者パスコード (スコア個別削除・リセット用)
window.ADMIN_PASSCODE = '1827';
