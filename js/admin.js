// Backpack Battles - エッグスシミュ 設問管理ダッシュボード (admin.js)
// backpack-battles-wikiと同等のクラシックスクリプト構成（ローカルfile://およびWeb環境完全両対応）

(function() {
    // 依存モジュールの解決（グローバルから取得、未検出時は内蔵フォールバックで自立動作）
    const FALLBACK_DEFAULT_CHALLENGES = [
        {
            id: 'pattern_1',
            name: 'パターン1: エッグス基礎検証（全解放盤面）',
            description: 'バッグなしの全63マスで、エッグスカリバー・トウガラシ・バナナ・マナオーブの基本シナジーとヒート速度を検証します。',
            mode: 'free',
            itemLimits: { eggscalibur: 1, chili: 8, banana: 4, cupcake: 2, mana_orb: 3 },
            bagLimits: { leather_bag: 0, fanny_pack: 0, stamina_bag: 0 }
        },
        {
            id: 'pattern_2',
            name: 'パターン2: バッグ構築・スタミナ制限チャレンジ',
            description: 'ウエストポーチとスタミナバッグを駆使し、限られたスペースでエッグスカリバーのCD短縮とスタミナを両立させる構成。',
            mode: 'bag',
            itemLimits: { eggscalibur: 1, chili: 6, banana: 3, cupcake: 3, mana_orb: 2 },
            bagLimits: { leather_bag: 4, fanny_pack: 3, stamina_bag: 2 }
        },
        {
            id: 'pattern_3',
            name: 'パターン3: マナオーブ特化・高速ヒート爆発',
            description: 'マナオーブを最大活用して35マナ到達（全バフ+3）を最速で狙い、ヒートを極限まで加速させるハイレベル構成。',
            mode: 'free',
            itemLimits: { eggscalibur: 2, chili: 10, banana: 6, cupcake: 4, mana_orb: 5 },
            bagLimits: { leather_bag: 0, fanny_pack: 0, stamina_bag: 0 }
        }
    ];

    class FallbackChallengeManager {
        constructor() {
            this.storageKey = 'bpb_eggscalibur_challenges_v1';
            this.activeChallengeId = 'pattern_1';
            this.challenges = this.loadChallenges();
            this.listeners = [];
        }
        onChange(listener) { this.listeners.push(listener); }
        notify() { for (const l of this.listeners) l(this.getActiveChallenge()); }
        loadChallenges() {
            try {
                const raw = localStorage.getItem(this.storageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (e) { console.warn(e); }
            return (window.DEFAULT_CHALLENGES || FALLBACK_DEFAULT_CHALLENGES).map(c => ({ ...c }));
        }
        saveChallenges() {
            try { localStorage.setItem(this.storageKey, JSON.stringify(this.challenges)); } catch (e) { console.error(e); }
        }
        getActiveChallenge() {
            return this.challenges.find(c => c.id === this.activeChallengeId) || this.challenges[0];
        }
        setActiveChallenge(id) {
            if (this.challenges.some(c => c.id === id)) {
                this.activeChallengeId = id;
                this.notify();
            }
        }
        addOrUpdateChallenge(challenge) {
            const idx = this.challenges.findIndex(c => c.id === challenge.id);
            if (idx >= 0) { this.challenges[idx] = challenge; } else { this.challenges.push(challenge); }
            this.saveChallenges();
            this.activeChallengeId = challenge.id;
            this.notify();
        }
        deleteChallenge(id) {
            if (this.challenges.length <= 1) return false;
            this.challenges = this.challenges.filter(c => c.id !== id);
            this.saveChallenges();
            if (this.activeChallengeId === id) this.activeChallengeId = this.challenges[0].id;
            this.notify();
            return true;
        }
        resetToDefaults() {
            this.challenges = (window.DEFAULT_CHALLENGES || FALLBACK_DEFAULT_CHALLENGES).map(c => ({ ...c }));
            this.activeChallengeId = 'pattern_1';
            this.saveChallenges();
            this.notify();
        }
    }

    const ChallengeManagerClass = window.ChallengeManager || FallbackChallengeManager;
    const LeaderboardManagerClass = window.LeaderboardManager || null;

    class AdminApp {
        constructor() {
            this.challenges = new ChallengeManagerClass();
            this.leaderboard = LeaderboardManagerClass ? new LeaderboardManagerClass() : null;
            this.currentEditingId = null; // nullなら新規作成

            this.initDOM();
            this.bindEvents();
            this.renderQuestionList();

            // 初期選択
            const initial = this.challenges.getActiveChallenge();
            if (initial) {
                this.selectQuestion(initial.id);
            }
        }

        initDOM() {
            this.dom = {
                questionList: document.getElementById('questionList'),
                btnCreateNew: document.getElementById('btnCreateNew'),
                btnExportJson: document.getElementById('btnExportJson'),
                btnImportJson: document.getElementById('btnImportJson'),
                fileInput: document.getElementById('fileInput'),
                btnResetDefaults: document.getElementById('btnResetDefaults'),

                saveAlertBanner: document.getElementById('saveAlertBanner'),
                saveAlertTitle: document.getElementById('saveAlertTitle'),
                saveAlertDesc: document.getElementById('saveAlertDesc'),
                saveAlertSimLink: document.getElementById('saveAlertSimLink'),
                btnDismissBanner: document.getElementById('btnDismissBanner'),

                questionForm: document.getElementById('questionForm'),
                formHeaderTitle: document.getElementById('formHeaderTitle'),
                formStatusBadge: document.getElementById('formStatusBadge'),
                formBadgeMode: document.getElementById('formBadgeMode'),

                inpId: document.getElementById('inpId'),
                inpName: document.getElementById('inpName'),
                inpDesc: document.getElementById('inpDesc'),
                inpMode: document.getElementById('inpMode'),
                bagLimitsSection: document.getElementById('bagLimitsSection'),

                inpLimitEgg: document.getElementById('inpLimitEgg'),
                inpLimitChili: document.getElementById('inpLimitChili'),
                inpLimitBanana: document.getElementById('inpLimitBanana'),
                inpLimitCupcake: document.getElementById('inpLimitCupcake'),
                inpLimitManaOrb: document.getElementById('inpLimitManaOrb'),

                inpLimitLeather: document.getElementById('inpLimitLeather'),
                inpLimitFanny: document.getElementById('inpLimitFanny'),
                inpLimitStamina: document.getElementById('inpLimitStamina'),

                btnDelete: document.getElementById('btnDelete'),
                btnClearScores: document.getElementById('btnClearScores'),
                btnSave: document.getElementById('btnSave'),
                btnSaveNew: document.getElementById('btnSaveNew')
            };
        }

        bindEvents() {
            if (this.dom.btnCreateNew) {
                this.dom.btnCreateNew.addEventListener('click', () => this.startCreateNew());
            }

            // フォームのSubmitイベント（backpack-battles-wikiと同様の確実な送信処理）
            if (this.dom.questionForm) {
                this.dom.questionForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveCurrentQuestion();
                });
            }

            // 新規設問として保存ボタン
            if (this.dom.btnSaveNew) {
                this.dom.btnSaveNew.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.saveAsNewQuestion();
                });
            }

            if (this.dom.btnDelete) {
                this.dom.btnDelete.addEventListener('click', () => this.deleteCurrentQuestion());
            }
            if (this.dom.btnClearScores) {
                this.dom.btnClearScores.addEventListener('click', () => this.clearScoresForCurrent());
            }
            if (this.dom.btnDismissBanner) {
                this.dom.btnDismissBanner.addEventListener('click', () => {
                    if (this.dom.saveAlertBanner) this.dom.saveAlertBanner.style.display = 'none';
                });
            }

            if (this.dom.inpMode) {
                this.dom.inpMode.addEventListener('change', (e) => {
                    const isBag = e.target.value === 'bag';
                    if (this.dom.bagLimitsSection) this.dom.bagLimitsSection.style.display = isBag ? 'flex' : 'none';
                    if (this.dom.formBadgeMode) {
                        this.dom.formBadgeMode.textContent = isBag ? 'バッグ構築モード' : '全解放モード';
                        this.dom.formBadgeMode.className = `badge mode-${e.target.value}`;
                    }
                });
            }

            // JSON エクスポート / インポート
            if (this.dom.btnExportJson) {
                this.dom.btnExportJson.addEventListener('click', () => this.exportJson());
            }
            if (this.dom.btnImportJson) {
                this.dom.btnImportJson.addEventListener('click', () => this.dom.fileInput?.click());
            }
            if (this.dom.fileInput) {
                this.dom.fileInput.addEventListener('change', (e) => this.importJson(e));
            }
            if (this.dom.btnResetDefaults) {
                this.dom.btnResetDefaults.addEventListener('click', () => this.resetDefaults());
            }
        }

        renderQuestionList() {
            if (!this.dom.questionList) return;
            this.dom.questionList.innerHTML = '';

            this.challenges.challenges.forEach((q) => {
                const div = document.createElement('div');
                div.className = `question-item ${q.id === this.currentEditingId ? 'active' : ''}`;
                div.dataset.id = q.id;

                const modeLabel = q.mode === 'free' ? '全解放' : 'バッグ構築';
                const eggLimit = q.itemLimits?.eggscalibur ?? 1;

                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="question-item-title">${this.escapeHtml(q.name)}</div>
                        <a href="index.html?pattern=${q.id}" class="btn" style="padding: 2px 6px; font-size: 10px; text-decoration: none; background: rgba(59, 130, 246, 0.2); border-color: #3b82f6; color: #93c5fd;" onclick="event.stopPropagation();">🎮 シミュレーターで開く</a>
                    </div>
                    <div class="question-item-sub">
                        <span>ID: ${q.id}</span>
                        <span class="badge mode-${q.mode}">${modeLabel}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); line-height: 1.3;">
                        エッグス:${eggLimit}個 / 🌶️:${q.itemLimits?.chili ?? 0} / 🍌:${q.itemLimits?.banana ?? 0} / 🔮:${q.itemLimits?.mana_orb ?? 0}
                    </div>
                `;

                div.addEventListener('click', () => this.selectQuestion(q.id));
                this.dom.questionList.appendChild(div);
            });
        }

        escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        selectQuestion(id) {
            const q = this.challenges.challenges.find(c => c.id === id);
            if (!q) return;

            this.currentEditingId = q.id;
            if (this.dom.formHeaderTitle) this.dom.formHeaderTitle.textContent = `設問の編集: ${q.name}`;
            if (this.dom.formStatusBadge) {
                this.dom.formStatusBadge.textContent = '✏️ 既存設問を編集中';
                this.dom.formStatusBadge.style.color = '#fbbf24';
                this.dom.formStatusBadge.style.borderColor = '#f59e0b';
                this.dom.formStatusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
            }

            if (this.dom.btnDelete) this.dom.btnDelete.disabled = false;
            if (this.dom.btnClearScores) this.dom.btnClearScores.disabled = false;
            if (this.dom.btnSave) this.dom.btnSave.disabled = false;
            if (this.dom.inpId) this.dom.inpId.disabled = true; // 既存IDは安全のためロック

            // フォームにセット
            if (this.dom.inpId) this.dom.inpId.value = q.id;
            if (this.dom.inpName) this.dom.inpName.value = q.name;
            if (this.dom.inpDesc) this.dom.inpDesc.value = q.description || '';
            if (this.dom.inpMode) this.dom.inpMode.value = q.mode;

            const isBag = q.mode === 'bag';
            if (this.dom.bagLimitsSection) this.dom.bagLimitsSection.style.display = isBag ? 'flex' : 'none';
            if (this.dom.formBadgeMode) {
                this.dom.formBadgeMode.textContent = isBag ? 'バッグ構築モード' : '全解放モード';
                this.dom.formBadgeMode.className = `badge mode-${q.mode}`;
            }

            // アイテム上限
            if (this.dom.inpLimitEgg) this.dom.inpLimitEgg.value = q.itemLimits?.eggscalibur ?? 1;
            if (this.dom.inpLimitChili) this.dom.inpLimitChili.value = q.itemLimits?.chili ?? 8;
            if (this.dom.inpLimitBanana) this.dom.inpLimitBanana.value = q.itemLimits?.banana ?? 4;
            if (this.dom.inpLimitCupcake) this.dom.inpLimitCupcake.value = q.itemLimits?.cupcake ?? 3;
            if (this.dom.inpLimitManaOrb) this.dom.inpLimitManaOrb.value = q.itemLimits?.mana_orb ?? 3;

            // バッグ上限
            if (this.dom.inpLimitLeather) this.dom.inpLimitLeather.value = q.bagLimits?.leather_bag ?? 4;
            if (this.dom.inpLimitFanny) this.dom.inpLimitFanny.value = q.bagLimits?.fanny_pack ?? 3;
            if (this.dom.inpLimitStamina) this.dom.inpLimitStamina.value = q.bagLimits?.stamina_bag ?? 2;

            this.renderQuestionList();
        }

        startCreateNew() {
            this.currentEditingId = null;
            if (this.dom.formHeaderTitle) this.dom.formHeaderTitle.textContent = '新規設問の作成';
            if (this.dom.formStatusBadge) {
                this.dom.formStatusBadge.textContent = '🟢 新規設問を作成中';
                this.dom.formStatusBadge.style.color = '#34d399';
                this.dom.formStatusBadge.style.borderColor = '#10b981';
                this.dom.formStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            }

            if (this.dom.btnDelete) this.dom.btnDelete.disabled = true;
            if (this.dom.btnClearScores) this.dom.btnClearScores.disabled = true;
            if (this.dom.btnSave) this.dom.btnSave.disabled = true; // 新規作成時は「新規設問として保存」を使用
            if (this.dom.inpId) this.dom.inpId.disabled = false;

            // 次の空きIDを自動計算
            let nextNum = this.challenges.challenges.length + 1;
            while (this.challenges.challenges.some(c => c.id === `pattern_${nextNum}`)) {
                nextNum++;
            }

            if (this.dom.inpId) this.dom.inpId.value = `pattern_${nextNum}`;
            if (this.dom.inpName) this.dom.inpName.value = `パターン${nextNum}: 新規検証設問`;
            if (this.dom.inpDesc) this.dom.inpDesc.value = '';
            if (this.dom.inpMode) this.dom.inpMode.value = 'free';

            if (this.dom.bagLimitsSection) this.dom.bagLimitsSection.style.display = 'none';
            if (this.dom.formBadgeMode) {
                this.dom.formBadgeMode.textContent = '全解放モード';
                this.dom.formBadgeMode.className = 'badge mode-free';
            }

            if (this.dom.inpLimitEgg) this.dom.inpLimitEgg.value = 1;
            if (this.dom.inpLimitChili) this.dom.inpLimitChili.value = 8;
            if (this.dom.inpLimitBanana) this.dom.inpLimitBanana.value = 4;
            if (this.dom.inpLimitCupcake) this.dom.inpLimitCupcake.value = 3;
            if (this.dom.inpLimitManaOrb) this.dom.inpLimitManaOrb.value = 3;

            if (this.dom.inpLimitLeather) this.dom.inpLimitLeather.value = 4;
            if (this.dom.inpLimitFanny) this.dom.inpLimitFanny.value = 3;
            if (this.dom.inpLimitStamina) this.dom.inpLimitStamina.value = 2;

            this.renderQuestionList();
            this.dom.inpName?.focus();
        }

        getFormData() {
            const name = this.dom.inpName?.value.trim() || '';
            const description = this.dom.inpDesc?.value.trim() || '';
            const mode = this.dom.inpMode?.value || 'free';

            return {
                name,
                description,
                mode,
                itemLimits: {
                    eggscalibur: parseInt(this.dom.inpLimitEgg?.value) || 0,
                    chili: parseInt(this.dom.inpLimitChili?.value) || 0,
                    banana: parseInt(this.dom.inpLimitBanana?.value) || 0,
                    cupcake: parseInt(this.dom.inpLimitCupcake?.value) || 0,
                    mana_orb: parseInt(this.dom.inpLimitManaOrb?.value) || 0
                },
                bagLimits: mode === 'bag' ? {
                    leather_bag: parseInt(this.dom.inpLimitLeather?.value) || 0,
                    fanny_pack: parseInt(this.dom.inpLimitFanny?.value) || 0,
                    stamina_bag: parseInt(this.dom.inpLimitStamina?.value) || 0
                } : {
                    leather_bag: 0,
                    fanny_pack: 0,
                    stamina_bag: 0
                }
            };
        }

        triggerButtonFeedback(btn, successText, originalText) {
            if (!btn) return;
            btn.classList.add('btn-saved-active');
            const prevText = btn.textContent;
            btn.textContent = successText;
            setTimeout(() => {
                btn.classList.remove('btn-saved-active');
                btn.textContent = originalText || prevText;
            }, 2500);
        }

        showBanner(title, desc, questionId) {
            if (!this.dom.saveAlertBanner) return;
            if (this.dom.saveAlertTitle) this.dom.saveAlertTitle.textContent = title;
            if (this.dom.saveAlertDesc) this.dom.saveAlertDesc.textContent = desc;
            if (this.dom.saveAlertSimLink) {
                this.dom.saveAlertSimLink.href = `index.html?pattern=${questionId}`;
            }
            this.dom.saveAlertBanner.style.display = 'block';
            this.dom.saveAlertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        saveCurrentQuestion() {
            if (!this.currentEditingId) {
                alert('⚠️ 新規設問を作成する場合は「➕ 新規設問として保存」ボタンを押してください。');
                return;
            }

            const formData = this.getFormData();
            if (!formData.name) {
                alert('⚠️ 設問タイトルを入力してください。');
                this.dom.inpName?.focus();
                return;
            }

            const question = {
                id: this.currentEditingId,
                ...formData
            };

            this.challenges.addOrUpdateChallenge(question);
            localStorage.setItem('bpb_eggscalibur_last_saved', this.currentEditingId);

            this.selectQuestion(this.currentEditingId);
            this.triggerButtonFeedback(this.dom.btnSave, '✅ 上書き保存完了！', '💾 変更を上書き保存');
            this.showBanner(
                `✅ 設問「${formData.name}」の変更を上書き保存しました！`,
                'シミュレーターのパターン選択へ即時反映されました。今すぐ検証可能です。',
                this.currentEditingId
            );
            this.showToast(`✅ 設問「${formData.name}」の変更を上書き保存しました！`, 'success');
            this.flashQuestionCard(this.currentEditingId);

            // backpack-battles-wikiと同等の確実なモーダルダイアログ
            alert(`✅ 設問「${formData.name}」の変更を上書き保存しました！\n（※シミュレーター画面のパターン選択に即時反映されています）`);
        }

        saveAsNewQuestion() {
            const formData = this.getFormData();
            if (!formData.name) {
                alert('⚠️ 設問タイトルを入力してください。');
                this.dom.inpName?.focus();
                return;
            }

            let newId = this.dom.inpId?.value.trim();
            // IDが空または既に使われている場合は自動連番を割り当て
            if (!newId || this.challenges.challenges.some(c => c.id === newId)) {
                let nextNum = this.challenges.challenges.length + 1;
                while (this.challenges.challenges.some(c => c.id === `pattern_${nextNum}`)) {
                    nextNum++;
                }
                newId = `pattern_${nextNum}`;
            }

            const newQuestion = {
                id: newId,
                ...formData
            };

            this.challenges.addOrUpdateChallenge(newQuestion);
            localStorage.setItem('bpb_eggscalibur_last_saved', newId);

            this.currentEditingId = newId;
            this.selectQuestion(newId);
            this.triggerButtonFeedback(this.dom.btnSaveNew, '🎉 新規保存完了！', '➕ 新規設問として保存');
            this.showBanner(
                `🎉 新規設問「${formData.name}」(ID: ${newId}) を正常に追加・保存しました！`,
                '左側の一覧に追加され、シミュレーターのパターン選択にも即時反映されました。',
                newId
            );
            this.showToast(`🎉 新規設問「${formData.name}」(ID: ${newId}) を正常に追加・保存しました！`, 'success');
            this.flashQuestionCard(newId);

            // backpack-battles-wikiと同等の確実なモーダルダイアログ
            alert(`🎉 新規設問「${formData.name}」(ID: ${newId}) を正常に追加・保存しました！\n（※一覧に追加され、シミュレーターにも即時反映されました）`);
        }

        flashQuestionCard(id) {
            setTimeout(() => {
                const el = document.querySelector(`.question-item[data-id="${id}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    el.style.transition = 'all 0.4s ease';
                    el.style.borderColor = '#10b981';
                    el.style.boxShadow = '0 0 18px rgba(16, 185, 129, 0.7)';
                    setTimeout(() => {
                        el.style.boxShadow = 'none';
                    }, 2000);
                }
            }, 100);
        }

        showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            const toast = document.createElement('div');
            toast.style.padding = '14px 20px';
            toast.style.borderRadius = '10px';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '700';
            toast.style.color = '#ffffff';
            toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6)';
            toast.style.backdropFilter = 'blur(10px)';
            toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            toast.style.transform = 'translateY(-10px)';
            toast.style.opacity = '1';
            toast.style.pointerEvents = 'auto';

            if (type === 'success') {
                toast.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.98), rgba(5, 150, 105, 0.98))';
                toast.style.border = '2px solid #34d399';
            } else if (type === 'error') {
                toast.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.98), rgba(220, 38, 38, 0.98))';
                toast.style.border = '2px solid #f87171';
            } else {
                toast.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.98), rgba(217, 119, 6, 0.98))';
                toast.style.border = '2px solid #fbbf24';
            }

            toast.textContent = message;
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-15px)';
                setTimeout(() => toast.remove(), 350);
            }, 4000);
        }

        deleteCurrentQuestion() {
            if (!this.currentEditingId) return;
            const q = this.challenges.challenges.find(c => c.id === this.currentEditingId);
            if (!q) return;

            if (confirm(`設問「${q.name}」を本当に削除しますか？`)) {
                if (this.challenges.deleteChallenge(q.id)) {
                    alert(`設問「${q.name}」を削除しました。`);
                    const next = this.challenges.getActiveChallenge();
                    if (next) this.selectQuestion(next.id);
                } else {
                    alert('設問が1つしかないため削除できません。');
                }
            }
        }

        clearScoresForCurrent() {
            if (!this.currentEditingId) return;
            const q = this.challenges.challenges.find(c => c.id === this.currentEditingId);
            if (!q) return;

            if (confirm(`設問「${q.name}」に記録されている全ランキングスコアを消去しますか？`)) {
                if (this.leaderboard) this.leaderboard.clearChallengeScores(q.id);
                alert('スコア履歴を初期化しました。');
            }
        }

        exportJson() {
            const data = JSON.stringify(this.challenges.challenges, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eggscalibur_questions_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        importJson(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        if (confirm(`${parsed.length}件の設問データをインポートして上書きしますか？`)) {
                            this.challenges.challenges = parsed;
                            this.challenges.saveChallenges();
                            this.selectQuestion(parsed[0].id);
                            alert('インポートが完了しました！');
                        }
                    } else {
                        alert('有効な設問リストのJSON形式ではありません。');
                    }
                } catch (err) {
                    alert('JSONの解析に失敗しました: ' + err.message);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }

        resetDefaults() {
            if (confirm('すべての設問を初期プリセットに戻しますか？（カスタム設問は消去されます）')) {
                this.challenges.resetToDefaults();
                const first = this.challenges.getActiveChallenge();
                if (first) this.selectQuestion(first.id);
                alert('初期プリセットに復元しました。');
            }
        }
    }

    // 起動処理
    function init() {
        window.adminApp = new AdminApp();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
