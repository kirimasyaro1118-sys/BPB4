// Backpack Battles - エッグスシミュ メインアプリケーション (app.js)
// backpack-battles-wikiと同等のクラシックスクリプト構成（ローカルfile://およびWeb環境完全両対応）

(function() {
    const ITEMS = window.ITEMS;
    const ITEM_TYPES = window.ITEM_TYPES;
    const GridManager = window.GridManager;
    const BattleSimulator = window.BattleSimulator;
    const ChallengeManager = window.ChallengeManager;
    const LeaderboardManager = window.LeaderboardManager;

    if (!ITEMS || !GridManager || !BattleSimulator || !ChallengeManager) {
        console.error("依存スクリプトが読み込まれていません。HTML内のscriptタグの順序を確認してください。");
        return;
    }

class App {
    constructor() {
        this.grid = new GridManager(9, 7);
        this.challenges = new ChallengeManager();
        this.leaderboard = new LeaderboardManager();

        this.simTimer = null;
        this.simState = null;
        this.simSpeed = 2; // デフォルト2x
        this.battleDuration = 50.0; // 戦闘時間（50秒）
        this.lastSimResult = null;
        this.simAccumulator = 0; // 高精度サブステップ累積時間
        this.lastSimFrameTime = 0; // 前フレームのperformance.now()

        // ドラッグ中の一時状態
        this.dragState = {
            isDragging: false,
            sourceType: null, // 'palette' or 'board'
            itemId: null,
            instanceId: null,
            rotation: 0,
            hoverCol: null,
            hoverRow: null,
            lastMouseX: 0,
            lastMouseY: 0
        };
        this.dragGhostEl = null;

        // マウスが乗っている盤面アイテム・バッグの追跡（キーボード「R」回転用）
        this.hoveredItemInstanceId = null;
        this.hoveredBagInstanceId = null;
        this.lastRightClickTime = 0;

        // 編集モード ('item': アイテム移動, 'bag': バッグ移動)
        this.editMode = 'item';

        this.initDOM();
        this.bindEvents();

        // 初期パターンの決定: URLパラメータ > 直前保存パターン > アクティブパターン
        const urlParams = new URLSearchParams(window.location.search);
        const targetPattern = urlParams.get('pattern');
        if (targetPattern && this.challenges.challenges.some(c => c.id === targetPattern)) {
            this.challenges.setActiveChallenge(targetPattern);
        } else {
            // 基本は最も標準的でアイテムを自由に配置できる「パターン1（全解放盤面）」で開始
            this.challenges.setActiveChallenge('pattern_1');
        }

        // 初回訪問時・起動時は盤面に何も配置しない（空盤面からスタート）
        this.grid.clear();
        this.resetSimulation();

        // 🌟 来訪者カウンター初期化 (backpack-battles-wiki と共通)
        this.initGlobalCounter();

        // クラウドリーダーボードの初期ステータス反映
        this.renderCloudStatus();
    }

    /**
     * 🌟 世界累計来訪者カウンター機能 (二重API＋ローカルフォールバック対応)
     */
    async initGlobalCounter() {
        // 1. メインAPI: Abacus Counter API
        try {
            const response = await fetch("https://abacus.jasoncameron.dev/hit/katad-bpb-eggs/pageviews");
            if (response.ok) {
                const data = await response.json();
                const count = data.value || data.count;
                if (typeof count === 'number' && count > 0) {
                    this.updateGlobalCounterUI(count);
                    return;
                }
            }
        } catch (e) {
            console.warn("Primary counter API failed, trying secondary...", e);
        }

        // 2. サブAPI: CounterAPI.dev
        try {
            const response = await fetch("https://api.counterapi.dev/v1/katad-bpb-eggs/pageviews/up");
            if (response.ok) {
                const data = await response.json();
                const count = data.count || data.value;
                if (typeof count === 'number' && count > 0) {
                    this.updateGlobalCounterUI(count);
                    return;
                }
            }
        } catch (e) {
            console.warn("Secondary counter API failed, fallback to local counter...", e);
        }

        // 3. ローカルフォールバック（オフライン・通信ブロック時）
        let localCount = parseInt(localStorage.getItem('bpb_eggs_visit_counter') || '10', 10);
        localCount++;
        localStorage.setItem('bpb_eggs_visit_counter', localCount.toString());
        this.updateGlobalCounterUI(localCount);
    }

    updateGlobalCounterUI(value) {
        const el = document.getElementById('global-counter-value');
        if (!el) return;

        if (typeof value === 'number') {
            const formatted = value.toLocaleString();
            const html = formatted.split('').map(char => {
                if (char === ',') {
                    return `<span class="counter-comma">,</span>`;
                }
                return `<span class="counter-digit">${char}</span>`;
            }).join('');
            el.innerHTML = html;
        } else {
            el.innerHTML = `<span class="counter-digit offline-dash">${value}</span>`;
        }
    }

    initDOM() {
        // Elements
        this.dom = {
            backpackGrid: document.getElementById('backpackGrid'),
            itemPaletteList: document.getElementById('itemPaletteList'),
            bagPaletteList: document.getElementById('bagPaletteList'),
            bagPaletteSection: document.getElementById('bagPaletteSection'),

            modeSwitchBar: document.getElementById('modeSwitchBar'),
            btnModeItem: document.getElementById('btnModeItem'),
            btnModeBag: document.getElementById('btnModeBag'),
            modeSwitchHint: document.getElementById('modeSwitchHint'),
            
            selectChallenge: document.getElementById('selectChallenge'),
            challengeDesc: document.getElementById('challengeDesc'),
            badgeMode: document.getElementById('badgeMode'),
            badgeBagLimits: document.getElementById('badgeBagLimits'),
            badgeActiveMode: document.getElementById('badgeActiveMode'),
            
            valHeat: document.getElementById('valHeat'),
            labelHeat: document.getElementById('labelHeat'),
            subHeat: document.getElementById('subHeat'),
            valMana: document.getElementById('valMana'),
            labelMana: document.getElementById('labelMana'),
            barMana: document.getElementById('barMana'),
            cardManaMisses: document.getElementById('cardManaMisses'),
            valStamina: document.getElementById('valStamina'),
            labelStamina: document.getElementById('labelStamina'),
            barStamina: document.getElementById('barStamina'),
            cardStaminaMisses: document.getElementById('cardStaminaMisses'),
            valTimer: document.getElementById('valTimer'),
            
            btnStartSim: document.getElementById('btnStartSim'),
            btnInstantSim: document.getElementById('btnInstantSim'),
            btnResetSim: document.getElementById('btnResetSim'),
            selectSimSpeed: document.getElementById('selectSimSpeed'),
            btnClearBoard: document.getElementById('btnClearBoard'),
            trashBin: document.getElementById('trashBin'),
            
            statusIndicator: document.getElementById('statusIndicator'),
            resFinalHeat: document.getElementById('resFinalHeat'),
            resStaminaMisses: document.getElementById('resStaminaMisses'),
            bHeat: document.getElementById('bHeat'),
            bMana: document.getElementById('bMana'),
            bRegen: document.getElementById('bRegen'),
            bLuck: document.getElementById('bLuck'),
            bSpikes: document.getElementById('bSpikes'),
            bVamp: document.getElementById('bVamp'),
            bEmpower: document.getElementById('bEmpower'),
            
            heatChart: document.getElementById('heatChart'),
            battleLogs: document.getElementById('battleLogs'),
            leaderboardList: document.getElementById('leaderboardList'),
            inputPlayerName: document.getElementById('inputPlayerName'),
            btnSubmitScore: document.getElementById('btnSubmitScore'),
            btnRestoreTop: document.getElementById('btnRestoreTop'),
            btnAdminAuth: document.getElementById('btnAdminAuth'),
            badgeAdminMode: document.getElementById('badgeAdminMode'),
            btnAdminLogout: document.getElementById('btnAdminLogout'),

            badgeCloudStatus: document.getElementById('badgeCloudStatus'),
            modalCloudSync: document.getElementById('modalCloudSync'),
            modalCloudSyncBackdrop: document.getElementById('modalCloudSyncBackdrop'),
            modalCloudSyncBody: document.getElementById('modalCloudSyncBody'),
            btnModalCloudClose: document.getElementById('btnModalCloudClose'),
            btnModalCloudDismiss: document.getElementById('btnModalCloudDismiss')
        };

        this.renderGridCells();
        this.initChart();
    }

    renderGridCells() {
        this.dom.backpackGrid.innerHTML = '';
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.col = c;
                cell.dataset.row = r;
                this.dom.backpackGrid.appendChild(cell);
            }
        }
    }

    bindEvents() {
        // Grid change listener
        this.grid.onChange(() => {
            this.renderBoard();
            this.updatePaletteCounts();
        });

        // Challenges change listener
        this.challenges.onChange((ch) => {
            this.applyChallenge(ch);
            if (this.leaderboard && ch) {
                this.leaderboard.subscribeChallenge(ch.id);
            }
            this.renderLeaderboard();
        });

        // Leaderboard change listener
        this.leaderboard.onChange(() => {
            this.renderLeaderboard();
            this.renderCloudStatus();
        });

        // Cloud status badge click
        if (this.dom.badgeCloudStatus) {
            this.dom.badgeCloudStatus.addEventListener('click', () => {
                this.openCloudSyncModal();
            });
        }

        // Cloud sync guide modal close
        if (this.dom.btnModalCloudClose) {
            this.dom.btnModalCloudClose.addEventListener('click', () => this.closeCloudSyncModal());
        }
        if (this.dom.btnModalCloudDismiss) {
            this.dom.btnModalCloudDismiss.addEventListener('click', () => this.closeCloudSyncModal());
        }
        if (this.dom.modalCloudSyncBackdrop) {
            this.dom.modalCloudSyncBackdrop.addEventListener('click', () => this.closeCloudSyncModal());
        }

        // Select challenge
        this.dom.selectChallenge.addEventListener('change', (e) => {
            this.grid.clear();
            const chId = e.target.value;
            this.challenges.setActiveChallenge(chId);
            if (this.leaderboard) {
                this.leaderboard.subscribeChallenge(chId);
            }
            this.renderLeaderboard();
        });

        // Speed select: 戦闘中であっても即座に新しい速度へスムーズに切り替わる
        this.dom.selectSimSpeed.addEventListener('change', (e) => {
            this.simSpeed = parseFloat(e.target.value);
            if (this.simTimer) {
                // 実行中の場合は基準タイムスタンプを更新して即座に新倍率で進行
                this.lastSimFrameTime = performance.now();
            }
        });

        // Buttons
        this.dom.btnStartSim.addEventListener('click', () => this.toggleSimulation());
        this.dom.btnInstantSim.addEventListener('click', () => this.runInstantSimulation());
        this.dom.btnResetSim.addEventListener('click', () => this.resetSimulation());
        this.dom.btnClearBoard.addEventListener('click', () => {
            if (this.grid.placedItems.length === 0 && this.grid.placedBags.length === 0) {
                this.showTrashFeedback('盤面には何も配置されていません', false);
                return;
            }
            if (confirm('盤面の全アイテムとバッグを一括削除しますか？')) {
                this.grid.clear();
                this.resetSimulation();
                this.showTrashFeedback('💥 盤面を全削除しました', true);
            }
        });

        // Score submit
        this.dom.btnSubmitScore.addEventListener('click', () => this.submitScore());
        this.dom.btnRestoreTop.addEventListener('click', () => this.restoreTopPlacement());

        // 管理者認証ボタン (🔒)
        if (this.dom.btnAdminAuth) {
            this.dom.btnAdminAuth.addEventListener('click', async () => {
                const pass = prompt('管理者パスコードを入力してください:');
                if (pass === null) return;
                const ok = await this.leaderboard.setAdminPasscode(pass.trim());
                if (ok) {
                    alert('管理者モードが有効になりました（スコア個別削除が可能です）');
                } else {
                    alert('パスコードが正しくありません。');
                }
            });
        }

        // 管理者解除ボタン
        if (this.dom.btnAdminLogout) {
            this.dom.btnAdminLogout.addEventListener('click', () => {
                this.leaderboard.logoutAdmin();
                alert('管理者モードを解除しました。');
            });
        }

        // 操作モード切替ボタン (アイテム移動 / バッグ移動)
        if (this.dom.btnModeItem) {
            this.dom.btnModeItem.addEventListener('click', () => this.setEditMode('item'));
        }
        if (this.dom.btnModeBag) {
            this.dom.btnModeBag.addEventListener('click', () => this.setEditMode('bag'));
        }

        // === コンテキストメニュー完全抑止 & 右クリック回転 ===
        // バックパック盤面内、ボードコンテナ内、パレット、またはドラッグ中はブラウザ既定のコンテキストメニューを完全に禁止
        const shouldSuppressContextMenu = (e) => {
            return this.dragState.isDragging ||
                   e.target.closest('#backpackGrid') ||
                   e.target.closest('.board-container') ||
                   e.target.closest('#trashBin') ||
                   e.target.closest('.palette-item') ||
                   e.target.closest('.placed-item') ||
                   e.target.closest('.placed-bag');
        };

        // contextmenuイベントはメニュー表示の抑止専用（回転処理は行わないことで2回回転を完全防止！）
        window.addEventListener('contextmenu', (e) => {
            if (shouldSuppressContextMenu(e)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { capture: true });

        // 右クリック回転は mousedown (button === 2) のみで1回だけ即時実行
        window.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                if (shouldSuppressContextMenu(e)) {
                    e.preventDefault();
                }
                if (this.dragState.isDragging) {
                    this.rotateDraggingItem();
                }
            }
        }, { capture: true });

        // ページ復帰時（戻るボタンなど）に最新の設問リストを再取得
        const syncLatestPatterns = () => {
            const currentActiveId = this.challenges.activeChallengeId;
            this.challenges.challenges = this.challenges.loadChallenges();
            this.renderChallengeSelectOptions();

            // 現在アクティブな設問が存在すればそれを維持
            if (this.challenges.challenges.some(c => c.id === currentActiveId)) {
                this.challenges.setActiveChallenge(currentActiveId);
            } else {
                // 削除等で存在しない場合のみ先頭パターンを適用
                const fallback = this.challenges.challenges[0];
                if (fallback) this.challenges.setActiveChallenge(fallback.id);
            }
        };

        window.addEventListener('pageshow', syncLatestPatterns);
        window.addEventListener('focus', syncLatestPatterns);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                syncLatestPatterns();
            }
        });

        // キーボード「R」でも回転可能（ドラッグ中、またはマウスホバー中のアイテム・バッグ）
        window.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
                return;
            }

            if (e.key === 'r' || e.key === 'R') {
                if (this.dragState.isDragging) {
                    e.preventDefault();
                    this.rotateDraggingItem();
                } else if (this.editMode === 'bag' && this.hoveredBagInstanceId) {
                    e.preventDefault();
                    this.rotateBagOnBoard(this.hoveredBagInstanceId);
                } else if (this.hoveredItemInstanceId) {
                    e.preventDefault();
                    this.rotateItemOnBoard(this.hoveredItemInstanceId);
                }
            } else if (e.key === 'Tab') {
                const ch = this.challenges.getActiveChallenge();
                if (ch && ch.mode === 'bag') {
                    e.preventDefault();
                    this.setEditMode(this.editMode === 'item' ? 'bag' : 'item');
                }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                // ドラッグ中の誤動作を防止
                if (this.dragState.isDragging) return;

                let dCol = 0;
                let dRow = 0;
                if (e.key === 'ArrowUp') dRow = -1;
                else if (e.key === 'ArrowDown') dRow = 1;
                else if (e.key === 'ArrowLeft') dCol = -1;
                else if (e.key === 'ArrowRight') dCol = 1;

                e.preventDefault(); // ページのスクロールを抑止
                const moved = this.grid.shiftAll(dCol, dRow, this.editMode);
                if (moved) {
                    this.resetSimulation();
                }
            }
        });

        // ヘッダー注意書きツールチップのインタラクション
        const noticePill = document.querySelector('.header-notice-pill');
        if (noticePill) {
            noticePill.addEventListener('mouseenter', () => noticePill.classList.add('tooltip-open'));
            noticePill.addEventListener('mouseleave', () => noticePill.classList.remove('tooltip-open'));
            noticePill.addEventListener('click', (e) => {
                e.stopPropagation();
                noticePill.classList.toggle('tooltip-open');
            });
            window.addEventListener('click', (e) => {
                if (!noticePill.contains(e.target)) {
                    noticePill.classList.remove('tooltip-open');
                }
            });
        }

        // グリッドおよびウィンドウのマウスイベント（ドラッグ＆ドロップ・ゴースト追従）
        window.addEventListener('mousemove', (e) => this.onGlobalMouseMove(e));
        this.dom.backpackGrid.addEventListener('mouseleave', () => this.onGridMouseLeave());
        window.addEventListener('mouseup', (e) => this.onGlobalMouseUp(e));
    }

    setEditMode(mode) {
        this.editMode = mode;
        if (this.dom.btnModeItem && this.dom.btnModeBag) {
            this.dom.btnModeItem.classList.toggle('active', mode === 'item');
            this.dom.btnModeBag.classList.toggle('active', mode === 'bag');
        }
        if (this.dom.backpackGrid) {
            this.dom.backpackGrid.classList.toggle('edit-mode-item', mode === 'item');
            this.dom.backpackGrid.classList.toggle('edit-mode-bag', mode === 'bag');
        }
        if (this.dom.modeSwitchHint) {
            if (mode === 'item') {
                this.dom.modeSwitchHint.textContent = '盤面のアイテムを直接移動できます（十字キーで一括移動）';
            } else {
                this.dom.modeSwitchHint.textContent = '配置済みバッグを直接移動・右クリック回転・削除できます（十字キーで一括移動）';
            }
        }
        // 盤面を再レンダリングしてホバー・ドラッグのインタラクションを最新モードに更新
        this.renderBoard();
    }

    applyChallenge(ch) {
        // UI更新
        this.renderChallengeSelectOptions();
        this.dom.selectChallenge.value = ch.id;
        this.dom.challengeDesc.textContent = ch.description;
        this.dom.badgeMode.textContent = `モード: ${ch.mode === 'free' ? '全解放' : 'バッグ構築'}`;
        this.dom.badgeActiveMode.textContent = ch.mode === 'free' ? '全解放' : 'バッグ構築';
        this.dom.badgeActiveMode.className = `badge mode-${ch.mode}`;
        
        if (ch.mode === 'free') {
            this.dom.badgeBagLimits.textContent = 'バッグ制限なし';
            this.dom.bagPaletteSection.style.display = 'none';
            if (this.dom.modeSwitchBar) this.dom.modeSwitchBar.style.display = 'none';
            this.setEditMode('item');
        } else {
            this.dom.badgeBagLimits.textContent = `革:${ch.bagLimits?.leather_bag || 0} / ウエスト:${ch.bagLimits?.fanny_pack || 0} / スタミナ:${ch.bagLimits?.stamina_bag || 0}`;
            this.dom.bagPaletteSection.style.display = 'block';
            if (this.dom.modeSwitchBar) this.dom.modeSwitchBar.style.display = 'flex';
            this.setEditMode('item');
        }

        this.grid.setMode(ch.mode);
        this.renderPalettes(ch);
        this.renderLeaderboard();
        this.resetSimulation();
    }

    renderChallengeSelectOptions() {
        this.dom.selectChallenge.innerHTML = '';
        for (const ch of this.challenges.challenges) {
            const opt = document.createElement('option');
            opt.value = ch.id;
            opt.textContent = ch.name;
            this.dom.selectChallenge.appendChild(opt);
        }
    }

    renderPalettes(ch) {
        // アイテムパレット
        const itemIds = ['eggscalibur', 'chili', 'banana', 'cupcake', 'mana_orb'];
        this.dom.itemPaletteList.innerHTML = '';

        for (const id of itemIds) {
            const def = ITEMS[id];
            const div = document.createElement('div');
            div.className = 'palette-item';
            div.dataset.itemId = id;
            div.title = def.description;

            div.innerHTML = `
                <div class="palette-item-info">
                    <div class="palette-item-icon">${def.icon}</div>
                    <div class="palette-item-text">
                        <div class="name">${def.name}</div>
                        <div class="spec">${def.baseCooldown ? `CD: ${def.baseCooldown}s` : 'パッシブ'}</div>
                    </div>
                </div>
                <div class="palette-item-count" id="count_${id}">0 / ${ch.itemLimits[id] ?? '∞'}</div>
            `;

            div.addEventListener('mousedown', (e) => this.startDragFromPalette(e, id));
            this.dom.itemPaletteList.appendChild(div);
        }

        // バッグパレット
        const bagIds = ['leather_bag', 'fanny_pack', 'stamina_bag'];
        this.dom.bagPaletteList.innerHTML = '';

        for (const id of bagIds) {
            const def = ITEMS[id];
            const div = document.createElement('div');
            div.className = 'palette-item';
            div.dataset.itemId = id;
            div.title = def.description;

            div.innerHTML = `
                <div class="palette-item-info">
                    <div class="palette-item-icon" style="border: 1px solid ${def.color}66; background: ${def.color}22;">${def.icon}</div>
                    <div class="palette-item-text">
                        <div class="name">${def.name}</div>
                        <div class="spec">${def.spec || def.description.split('。')[0]}</div>
                    </div>
                </div>
                <div class="palette-item-count" id="count_${id}">0 / ${ch.bagLimits?.[id] ?? '∞'}</div>
            `;

            div.addEventListener('mousedown', (e) => this.startDragFromPalette(e, id));
            this.dom.bagPaletteList.appendChild(div);
        }

        this.updatePaletteCounts();
    }

    updatePaletteCounts() {
        const ch = this.challenges.getActiveChallenge();
        
        // アイテムカウント
        for (const id of ['eggscalibur', 'chili', 'banana', 'cupcake', 'mana_orb']) {
            const count = this.grid.placedItems.filter(i => i.itemId === id).length;
            const limit = ch.itemLimits[id] ?? 99;
            const el = document.getElementById(`count_${id}`);
            if (el) {
                el.textContent = `${count} / ${limit}`;
                el.parentElement.classList.toggle('disabled', count >= limit);
            }
        }

        // バッグカウント
        for (const id of ['leather_bag', 'fanny_pack', 'stamina_bag']) {
            const count = this.grid.placedBags.filter(b => b.itemId === id).length;
            const limit = ch.bagLimits?.[id] ?? 99;
            const el = document.getElementById(`count_${id}`);
            if (el) {
                el.textContent = `${count} / ${limit}`;
                el.parentElement.classList.toggle('disabled', count >= limit);
            }
        }
    }

    /**
     * 盤面のレンダリング
     */
    renderBoard() {
        const cells = this.dom.backpackGrid.querySelectorAll('.grid-cell');
        cells.forEach(c => {
            c.className = 'grid-cell';
            c.innerHTML = ''; // インジケーター消去
        });

        // 1. バッグタイルの下地クラス付与
        for (const bag of this.grid.placedBags) {
            const cls = bag.itemId === 'fanny_pack' ? 'fanny-covered' :
                        bag.itemId === 'stamina_bag' ? 'stamina-covered' : 'bag-covered';

            for (const [dx, dy] of bag.coords) {
                const cell = this.getCell(bag.col + dx, bag.row + dy);
                if (cell) cell.classList.add(cls);
            }
        }

        // 2. 既存のアイテム・バッグ要素を消去して再描画
        const oldElements = this.dom.backpackGrid.querySelectorAll('.placed-item, .placed-bag, .star-indicator');
        oldElements.forEach(el => el.remove());

        const cellSize = 56;
        const gap = 2;

        // グリッドに現在の操作モードクラスを同期
        this.dom.backpackGrid.classList.toggle('edit-mode-item', this.editMode === 'item');
        this.dom.backpackGrid.classList.toggle('edit-mode-bag', this.editMode === 'bag');

        // 2.5. バッグ要素の描画（バッグ移動モード時にドラッグ・右クリック回転・削除が可能）
        for (const bag of this.grid.placedBags) {
            const def = ITEMS[bag.itemId];
            const bagEl = document.createElement('div');
            bagEl.className = `placed-bag bag-${bag.itemId}`;
            bagEl.dataset.instanceId = bag.instanceId;
            bagEl.id = `bag_${bag.instanceId}`;

            bagEl.style.left = `${bag.col * (cellSize + gap) + 4}px`;
            bagEl.style.top = `${bag.row * (cellSize + gap) + 4}px`;

            for (let i = 0; i < bag.coords.length; i++) {
                const [dx, dy] = bag.coords[i];
                const block = document.createElement('div');
                block.className = 'placed-bag-cell';
                block.style.left = `${dx * (cellSize + gap)}px`;
                block.style.top = `${dy * (cellSize + gap)}px`;
                block.style.borderColor = def.color;

                if (i === 0) {
                    const badge = document.createElement('div');
                    badge.className = 'bag-cell-badge';
                    badge.textContent = def.icon;
                    block.appendChild(badge);
                }
                bagEl.appendChild(block);
            }

            // ホバー追跡（バッグ回転用）
            bagEl.addEventListener('mouseenter', () => {
                if (this.editMode === 'bag') {
                    this.hoveredBagInstanceId = bag.instanceId;
                }
            });
            bagEl.addEventListener('mouseleave', () => {
                if (this.hoveredBagInstanceId === bag.instanceId) {
                    this.hoveredBagInstanceId = null;
                }
            });

            // コンテキストメニュー抑止
            bagEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            // 右クリック回転 & 左クリックドラッグ
            bagEl.addEventListener('mousedown', (e) => {
                if (this.editMode !== 'bag') return;
                if (e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.dragState.isDragging) {
                        this.rotateBagOnBoard(bag.instanceId, e);
                    }
                } else if (e.button === 0) {
                    this.startDragFromBoard(e, bag);
                }
            });

            this.dom.backpackGrid.appendChild(bagEl);
        }

        // 3. アイテムの星スロット（★）インジケーターを描画
        for (const item of this.grid.placedItems) {
            for (const [sx, sy] of item.starSlots) {
                const starX = item.col + sx;
                const starY = item.row + sy;
                const cell = this.getCell(starX, starY);
                if (cell && !cell.querySelector('.star-indicator')) {
                    const star = document.createElement('div');
                    star.className = 'star-indicator';
                    star.textContent = '★';
                    cell.appendChild(star);
                }
            }
        }

        // 4. アイテムの描画

        for (const item of this.grid.placedItems) {
            const def = ITEMS[item.itemId];
            const itemEl = document.createElement('div');
            itemEl.className = 'placed-item';
            itemEl.dataset.instanceId = item.instanceId;
            itemEl.id = `item_${item.instanceId}`;

            // ツールチップ設定
            if (def.type === ITEM_TYPES.FOOD && typeof this.grid.getAdjacentDifferentFoods === 'function') {
                const diffFoods = this.grid.getAdjacentDifferentFoods(item);
                const bonus = diffFoods.length * 10;
                itemEl.title = `${def.name} (基本CD: ${def.baseCooldown}s)\n【食べ物共通】隣接(上下左右)する種類の違う食べ物: ${diffFoods.length}個 (+${bonus}%加速)`;
            } else if (def.baseCooldown) {
                itemEl.title = `${def.name} (基本CD: ${def.baseCooldown}s)`;
            } else {
                itemEl.title = def.name;
            }

            // 左上オフセット計算
            itemEl.style.left = `${item.col * (cellSize + gap) + 4}px`;
            itemEl.style.top = `${item.row * (cellSize + gap) + 4}px`;

            // 各マスをレンダリング
            for (let i = 0; i < item.coords.length; i++) {
                const [dx, dy] = item.coords[i];
                const block = document.createElement('div');
                block.className = 'placed-item-cell';
                block.style.left = `${dx * (cellSize + gap)}px`;
                block.style.top = `${dy * (cellSize + gap)}px`;
                block.style.backgroundColor = def.color;

                // 最初のマスにアイコン表示
                if (i === 0) {
                    block.textContent = def.icon;
                }
                itemEl.appendChild(block);
            }

            // ホバー追跡（キーボード「R」キー回転用）
            itemEl.addEventListener('mouseenter', () => {
                this.hoveredItemInstanceId = item.instanceId;
            });
            itemEl.addEventListener('mouseleave', () => {
                if (this.hoveredItemInstanceId === item.instanceId) {
                    this.hoveredItemInstanceId = null;
                }
            });

            // コンテキストメニュー抑止専用
            itemEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            // 右クリック回転は mousedown (button === 2) のみで1回だけ即時実行
            itemEl.addEventListener('mousedown', (e) => {
                if (e.button === 2) {
                    // 右クリック
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.dragState.isDragging) {
                        this.rotateItemOnBoard(item.instanceId, e);
                    }
                } else if (e.button === 0) {
                    // 左クリック: ドラッグ開始
                    this.startDragFromBoard(e, item);
                }
            });

            this.dom.backpackGrid.appendChild(itemEl);
        }

        // スタミナ初期値表示の更新
        const staminaBagCount = this.grid.placedBags.filter(b => b.itemId === 'stamina_bag').length;
        const maxStamina = 5.0 + staminaBagCount * 1.0;
        this.dom.labelStamina.textContent = `${maxStamina.toFixed(1)} / ${maxStamina.toFixed(1)}`;
        this.dom.valStamina.textContent = maxStamina.toFixed(1);
    }

    getCell(col, row) {
        if (col < 0 || col >= 9 || row < 0 || row >= 7) return null;
        return this.dom.backpackGrid.children[row * 9 + col];
    }

    // === ドラッグ＆ドロップ処理 ===
    /**
     * アイテムの形状から掴む中心マスオフセット [offsetX, offsetY] を算出
     * 例: エッグスカリバー（横3x縦2 Sミノ）の場合、横方向の中央かつ本体が存在する [1, 0] を中心とする
     */
    getItemCenterOffset(shape) {
        if (!shape || shape.length === 0) return [0, 0];

        const maxX = Math.max(...shape.map(([x]) => x));
        const maxY = Math.max(...shape.map(([y]) => y));

        const midX = Math.floor(maxX / 2);
        const midY = Math.floor(maxY / 2);

        // バウンディングボックス中央 (midX, midY) にセルが存在すればそれを中心にする
        if (shape.some(([x, y]) => x === midX && y === midY)) {
            return [midX, midY];
        }

        // セルが存在しない場合は、中央に最も近いセルを選択
        let best = shape[0];
        let bestDist = Infinity;
        for (const [x, y] of shape) {
            const dist = Math.hypot(x - midX, y - midY);
            if (dist < bestDist) {
                bestDist = dist;
                best = [x, y];
            }
        }
        return best;
    }

    /**
     * マウスカーソル直下に追従する半透明ドラッグゴースト要素を生成
     */
    createDragGhost(itemId, rotation) {
        this.removeDragGhost();
        const def = ITEMS[itemId];
        if (!def) return;

        const { shape } = this.grid.getTransformedCoords(itemId, rotation);
        const [centerOffsetX, centerOffsetY] = this.getItemCenterOffset(shape);

        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.id = 'activeDragGhost';

        const cellSize = 56;
        const gap = 2;

        for (let i = 0; i < shape.length; i++) {
            const [dx, dy] = shape[i];
            const cell = document.createElement('div');
            cell.className = 'drag-ghost-cell';
            // 中心マス [centerOffsetX, centerOffsetY] を (0,0) とした相対オフセット配置
            cell.style.left = `${(dx - centerOffsetX) * (cellSize + gap)}px`;
            cell.style.top = `${(dy - centerOffsetY) * (cellSize + gap)}px`;
            cell.style.backgroundColor = def.color;

            if (i === 0) {
                cell.textContent = def.icon;
            }
            ghost.appendChild(cell);
        }

        document.body.appendChild(ghost);
        this.dragGhostEl = ghost;
    }

    moveDragGhost(clientX, clientY) {
        if (!this.dragGhostEl) return;
        const halfCell = 28; // 56 / 2
        this.dragGhostEl.style.left = `${clientX - halfCell}px`;
        this.dragGhostEl.style.top = `${clientY - halfCell}px`;
    }

    removeDragGhost() {
        if (this.dragGhostEl) {
            this.dragGhostEl.remove();
            this.dragGhostEl = null;
        }
    }

    startDragFromPalette(e, itemId) {
        if (e.button !== 0) return; // 左クリックのみ

        const def = ITEMS[itemId];
        const ch = this.challenges.getActiveChallenge();
        const isBag = def.type === ITEM_TYPES.BAG;

        // パレットからのドラッグ開始時に、対象に合わせて編集モードを適切に切替
        if (isBag && this.editMode !== 'bag') {
            this.setEditMode('bag');
        } else if (!isBag && this.editMode !== 'item') {
            this.setEditMode('item');
        }

        // 上限チェック
        if (isBag) {
            const count = this.grid.placedBags.filter(b => b.itemId === itemId).length;
            if (count >= (ch.bagLimits?.[itemId] ?? 99)) return;
        } else {
            const count = this.grid.placedItems.filter(i => i.itemId === itemId).length;
            if (count >= (ch.itemLimits[itemId] ?? 99)) return;
        }

        let initialRot = 0;

        this.dragState = {
            isDragging: true,
            sourceType: 'palette',
            itemId,
            instanceId: null,
            rotation: initialRot,
            hoverCol: null,
            hoverRow: null,
            lastMouseX: e.clientX,
            lastMouseY: e.clientY
        };

        this.createDragGhost(itemId, initialRot);
        this.moveDragGhost(e.clientX, e.clientY);
        if (this.dom.trashBin) {
            this.dom.trashBin.classList.add('drag-active');
        }
        this.onGlobalMouseMove(e);
    }

    startDragFromBoard(e, itemOrBag) {
        if (e.button !== 0) return; // 左クリックのみ

        const def = ITEMS[itemOrBag.itemId];
        const isBag = def?.type === ITEM_TYPES.BAG;

        this.dragState = {
            isDragging: true,
            sourceType: 'board',
            itemId: itemOrBag.itemId,
            instanceId: itemOrBag.instanceId,
            rotation: itemOrBag.rotation,
            hoverCol: itemOrBag.col,
            hoverRow: itemOrBag.row,
            lastMouseX: e.clientX,
            lastMouseY: e.clientY
        };

        // 元のアイテム/バッグを半透明化
        const elId = isBag ? `bag_${itemOrBag.instanceId}` : `item_${itemOrBag.instanceId}`;
        const el = document.getElementById(elId);
        if (el) el.style.opacity = '0.3';

        this.createDragGhost(itemOrBag.itemId, itemOrBag.rotation);
        this.moveDragGhost(e.clientX, e.clientY);
        if (this.dom.trashBin) {
            this.dom.trashBin.classList.add('drag-active');
        }
        this.onGlobalMouseMove(e);
    }

    onGlobalMouseMove(e) {
        this.dragState.lastMouseX = e.clientX;
        this.dragState.lastMouseY = e.clientY;

        if (!this.dragState.isDragging) return;

        this.moveDragGhost(e.clientX, e.clientY);

        // ゴミ箱エリアホバー判定
        const isOverTrash = this.isMouseOverTrash(e.clientX, e.clientY);
        if (this.dom.trashBin) {
            if (isOverTrash) {
                this.dom.trashBin.classList.add('drag-hover');
                const titleEl = this.dom.trashBin.querySelector('.trash-bin-title');
                const subEl = this.dom.trashBin.querySelector('.trash-bin-sub');
                if (titleEl) titleEl.textContent = 'ここでドロップして削除！';
                if (subEl) subEl.textContent = `${ITEMS[this.dragState.itemId]?.name || 'アイテム'}を盤面から撤去します`;

                this.dragState.hoverCol = null;
                this.dragState.hoverRow = null;
                this.clearHighlights();
                return;
            } else {
                this.dom.trashBin.classList.remove('drag-hover');
                const titleEl = this.dom.trashBin.querySelector('.trash-bin-title');
                const subEl = this.dom.trashBin.querySelector('.trash-bin-sub');
                if (titleEl) titleEl.textContent = 'ゴミ箱エリア';
                if (subEl) subEl.textContent = '不要なアイテムをここにドラッグ＆ドロップして削除';
            }
        }

        const rect = this.dom.backpackGrid.getBoundingClientRect();
        const cellSize = 56 + 2; // size + gap
        const x = e.clientX - rect.left - 4;
        const y = e.clientY - rect.top - 4;

        const mouseCol = Math.floor(x / cellSize);
        const mouseRow = Math.floor(y / cellSize);

        // アイテム形状と中心マスオフセットを取得
        const { shape } = this.grid.getTransformedCoords(this.dragState.itemId, this.dragState.rotation);
        const [centerOffsetX, centerOffsetY] = this.getItemCenterOffset(shape);

        // マウス位置がアイテムの中心マスになるよう左上原点 (hoverCol, hoverRow) を計算
        const targetCol = mouseCol - centerOffsetX;
        const targetRow = mouseRow - centerOffsetY;

        // グリッド領域内（中心マスが盤面近傍にあるか）
        if (mouseCol >= 0 && mouseCol < 9 && mouseRow >= 0 && mouseRow < 7) {
            this.dragState.hoverCol = targetCol;
            this.dragState.hoverRow = targetRow;
        } else {
            this.dragState.hoverCol = null;
            this.dragState.hoverRow = null;
        }

        this.updateDragPreview();
    }

    onGridMouseMove(e) {
        this.onGlobalMouseMove(e);
    }

    onGridMouseLeave() {
        if (this.dragState.isDragging) {
            this.dragState.hoverCol = null;
            this.dragState.hoverRow = null;
            this.clearHighlights();
        }
    }

    clearHighlights() {
        const cells = this.dom.backpackGrid.querySelectorAll('.grid-cell');
        cells.forEach(c => {
            c.classList.remove('highlight-valid', 'highlight-invalid');
        });
    }

    updateDragPreview() {
        this.clearHighlights();
        if (!this.dragState.isDragging || this.dragState.hoverCol === null) return;

        const { itemId, rotation, hoverCol, hoverRow, instanceId } = this.dragState;
        const def = ITEMS[itemId];
        const isBag = def.type === ITEM_TYPES.BAG;

        const canPlace = isBag ?
            this.grid.canPlaceBag(itemId, hoverCol, hoverRow, rotation, instanceId) :
            this.grid.canPlaceItem(itemId, hoverCol, hoverRow, rotation, instanceId);

        const { shape } = this.grid.getTransformedCoords(itemId, rotation);
        const cls = canPlace ? 'highlight-valid' : 'highlight-invalid';

        for (const [dx, dy] of shape) {
            const cell = this.getCell(hoverCol + dx, hoverRow + dy);
            if (cell) cell.classList.add(cls);
        }
    }

    onGlobalMouseUp(e) {
        // 重要: 左クリック(button === 0)以外の離脱（右クリック離脱など）ではドラッグを終了しない！
        if (e.button !== 0) return;
        if (!this.dragState.isDragging) return;

        this.removeDragGhost();

        const { itemId, rotation, hoverCol, hoverRow, sourceType, instanceId } = this.dragState;
        const def = ITEMS[itemId];
        const isBag = def.type === ITEM_TYPES.BAG;

        // ゴミ箱エリアへのドロップ判定
        const isOverTrash = this.isMouseOverTrash(e.clientX, e.clientY);

        if (isOverTrash) {
            if (sourceType === 'board' && instanceId) {
                // 盤面上のアイテムをゴミ箱にドロップして削除！
                this.deleteItemToTrash(instanceId, itemId);
            } else if (sourceType === 'palette') {
                this.showTrashFeedback('配置をキャンセルしました', false);
            }
        } else if (hoverCol !== null && hoverRow !== null) {
            if (sourceType === 'palette') {
                if (isBag) {
                    this.grid.placeBag(itemId, hoverCol, hoverRow, rotation);
                } else {
                    this.grid.placeItem(itemId, hoverCol, hoverRow, rotation);
                }
            } else if (sourceType === 'board') {
                if (isBag) {
                    // バッグの移動
                    this.grid.moveBag(instanceId, hoverCol, hoverRow, rotation);
                } else {
                    this.grid.moveItem(instanceId, hoverCol, hoverRow, rotation);
                }
            }
        }

        // リセット
        if (instanceId) {
            const elId = isBag ? `bag_${instanceId}` : `item_${instanceId}`;
            const el = document.getElementById(elId);
            if (el) el.style.opacity = '1';
        }

        if (this.dom.trashBin) {
            this.dom.trashBin.classList.remove('drag-active', 'drag-hover');
            const titleEl = this.dom.trashBin.querySelector('.trash-bin-title');
            const subEl = this.dom.trashBin.querySelector('.trash-bin-sub');
            if (titleEl) titleEl.textContent = 'ゴミ箱エリア';
            if (subEl) subEl.textContent = '不要なアイテムをここにドラッグ＆ドロップして削除';
        }

        this.dragState = {
            isDragging: false,
            sourceType: null,
            itemId: null,
            instanceId: null,
            rotation: 0,
            hoverCol: null,
            hoverRow: null,
            lastMouseX: 0,
            lastMouseY: 0
        };

        this.clearHighlights();
    }

    /**
     * ドラッグ中のアイテムを90度回転（中心位置とゴーストを維持）
     */
    rotateDraggingItem() {
        if (!this.dragState.isDragging) return;
        this.dragState.rotation = (this.dragState.rotation + 1) % 4;

        // ゴースト要素を新しい回転で再生成
        this.createDragGhost(this.dragState.itemId, this.dragState.rotation);
        this.moveDragGhost(this.dragState.lastMouseX, this.dragState.lastMouseY);

        // マウス位置から中心オフセットを再計算して hoverCol/hoverRow を即時更新
        const rect = this.dom.backpackGrid.getBoundingClientRect();
        const cellSize = 56 + 2;
        const x = this.dragState.lastMouseX - rect.left - 4;
        const y = this.dragState.lastMouseY - rect.top - 4;
        const mouseCol = Math.floor(x / cellSize);
        const mouseRow = Math.floor(y / cellSize);

        if (mouseCol >= 0 && mouseCol < 9 && mouseRow >= 0 && mouseRow < 7) {
            const { shape } = this.grid.getTransformedCoords(this.dragState.itemId, this.dragState.rotation);
            const [centerOffsetX, centerOffsetY] = this.getItemCenterOffset(shape);
            this.dragState.hoverCol = mouseCol - centerOffsetX;
            this.dragState.hoverRow = mouseRow - centerOffsetY;
        }

        this.updateDragPreview();
    }

    /**
     * 盤面上のアイテムをその場で90度回転（カーソル直下にアイテムマスを維持するピボット補正＆壁際補正あり）
     */
    rotateItemOnBoard(instanceId, e = null) {
        const item = this.grid.placedItems.find(i => i.instanceId === instanceId);
        if (!item) return;

        const nextRot = (item.rotation + 1) % 4;
        const { shape: nextShape } = this.grid.getTransformedCoords(item.itemId, nextRot);

        // イベントeまたは最新マウス座標から、右クリックしたマス座標を取得
        const clientX = e ? e.clientX : this.dragState.lastMouseX;
        const clientY = e ? e.clientY : this.dragState.lastMouseY;

        if (clientX && clientY) {
            const rect = this.dom.backpackGrid.getBoundingClientRect();
            const cellSize = 56 + 2;
            const x = clientX - rect.left - 4;
            const y = clientY - rect.top - 4;
            const mouseCol = Math.floor(x / cellSize);
            const mouseRow = Math.floor(y / cellSize);

            // 1. マウスカーソル (mouseCol, mouseRow) の直下に、回転後アイテムのいずれかのマスが必ず重なる配置を最優先で探索！
            // これにより、トウガラシ・バナナ・エッグスを回転させたときにカーソルがアイテム判定の外へ逃げず、連続回転やドラッグが可能に！
            const candidates = [];
            for (const [dx, dy] of nextShape) {
                const tryCol = mouseCol - dx;
                const tryRow = mouseRow - dy;
                // 元のアイテム位置からのズレ量をペナルティとして計算（一番近い自然な回転を優先）
                const shiftDist = Math.hypot(tryCol - item.col, tryRow - item.row);
                candidates.push({ col: tryCol, row: tryRow, dist: shiftDist });
            }
            candidates.sort((a, b) => a.dist - b.dist);

            for (const cand of candidates) {
                if (this.grid.canPlaceItem(item.itemId, cand.col, cand.row, nextRot, instanceId)) {
                    this.grid.moveItem(instanceId, cand.col, cand.row, nextRot);
                    this.resetSimulation();
                    return;
                }
            }
        }

        // 2. マウス直下に合わせられない場合、元の原点 (item.col, item.row) での回転を試す
        if (this.grid.canPlaceItem(item.itemId, item.col, item.row, nextRot, instanceId)) {
            this.grid.moveItem(instanceId, item.col, item.row, nextRot);
            this.resetSimulation();
            return;
        }

        // 3. 盤面端や壁際で、少しずらせば置ける場合（壁キック補正）
        const offsets = [
            [0, -1], [-1, 0], [0, 1], [1, 0],
            [-1, -1], [1, -1], [-1, 1], [1, 1],
            [-2, 0], [0, -2], [2, 0], [0, 2]
        ];
        for (const [ox, oy] of offsets) {
            const tryCol = item.col + ox;
            const tryRow = item.row + oy;
            if (this.grid.canPlaceItem(item.itemId, tryCol, tryRow, nextRot, instanceId)) {
                this.grid.moveItem(instanceId, tryCol, tryRow, nextRot);
                this.resetSimulation();
                return;
            }
        }

        // 4. 回転不可能な場合（他のアイテムに完全に塞がれているなど）は振動アニメーション
        const el = document.getElementById(`item_${instanceId}`);
        if (el) {
            el.classList.remove('miss-shake');
            void el.offsetWidth;
            el.classList.add('miss-shake');
        }
    }

    /**
     * 盤面上のバッグをその場で90度回転（カーソル直下にバッグマスを維持するピボット補正＆壁キックあり）
     */
    rotateBagOnBoard(instanceId, e = null) {
        const bag = this.grid.placedBags.find(b => b.instanceId === instanceId);
        if (!bag) return;

        const nextRot = (bag.rotation + 1) % 4;
        const { shape: nextShape } = this.grid.getTransformedCoords(bag.itemId, nextRot);

        const clientX = e ? e.clientX : this.dragState.lastMouseX;
        const clientY = e ? e.clientY : this.dragState.lastMouseY;

        if (clientX && clientY) {
            const rect = this.dom.backpackGrid.getBoundingClientRect();
            const cellSize = 56 + 2;
            const x = clientX - rect.left - 4;
            const y = clientY - rect.top - 4;
            const mouseCol = Math.floor(x / cellSize);
            const mouseRow = Math.floor(y / cellSize);

            const candidates = [];
            for (const [dx, dy] of nextShape) {
                const tryCol = mouseCol - dx;
                const tryRow = mouseRow - dy;
                const shiftDist = Math.hypot(tryCol - bag.col, tryRow - bag.row);
                candidates.push({ col: tryCol, row: tryRow, dist: shiftDist });
            }
            candidates.sort((a, b) => a.dist - b.dist);

            for (const cand of candidates) {
                if (this.grid.canPlaceBag(bag.itemId, cand.col, cand.row, nextRot, instanceId)) {
                    this.grid.moveBag(instanceId, cand.col, cand.row, nextRot);
                    this.resetSimulation();
                    return;
                }
            }
        }

        if (this.grid.canPlaceBag(bag.itemId, bag.col, bag.row, nextRot, instanceId)) {
            this.grid.moveBag(instanceId, bag.col, bag.row, nextRot);
            this.resetSimulation();
            return;
        }

        const offsets = [
            [0, -1], [-1, 0], [0, 1], [1, 0],
            [-1, -1], [1, -1], [-1, 1], [1, 1],
            [-2, 0], [0, -2], [2, 0], [0, 2]
        ];
        for (const [ox, oy] of offsets) {
            const tryCol = bag.col + ox;
            const tryRow = bag.row + oy;
            if (this.grid.canPlaceBag(bag.itemId, tryCol, tryRow, nextRot, instanceId)) {
                this.grid.moveBag(instanceId, tryCol, tryRow, nextRot);
                this.resetSimulation();
                return;
            }
        }

        const el = document.getElementById(`bag_${instanceId}`);
        if (el) {
            el.classList.remove('miss-shake');
            void el.offsetWidth;
            el.classList.add('miss-shake');
        }
    }

    // === ゴミ箱・削除処理 ===
    isMouseOverTrash(clientX, clientY) {
        if (!this.dom.trashBin) return false;
        const rect = this.dom.trashBin.getBoundingClientRect();
        return clientX >= rect.left - 10 && clientX <= rect.right + 10 &&
               clientY >= rect.top - 10 && clientY <= rect.bottom + 10;
    }

    deleteItemToTrash(instanceId, itemId) {
        const def = ITEMS[itemId];
        const name = def ? def.name : 'アイテム';
        const isBag = def?.type === ITEM_TYPES.BAG;

        // 盤面から削除
        if (isBag) {
            this.grid.removeBag(instanceId);
        } else {
            this.grid.removeItem(instanceId);
        }

        // ゴミ箱のポップ演出
        if (this.dom.trashBin) {
            this.dom.trashBin.classList.remove('deleted-pop');
            void this.dom.trashBin.offsetWidth;
            this.dom.trashBin.classList.add('deleted-pop');
            setTimeout(() => {
                if (this.dom.trashBin) this.dom.trashBin.classList.remove('deleted-pop');
            }, 400);
        }

        // トースト通知
        this.showTrashFeedback(`🗑️ ${name} を削除しました`, true);

        // 盤面変更に伴うシミュレーションリセット
        this.resetSimulation();
    }

    showTrashFeedback(message, isSuccess = true) {
        let container = document.getElementById('trashToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'trashToastContainer';
            container.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 10000; pointer-events: none; display: flex; flex-direction: column; gap: 8px; align-items: center;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${isSuccess ? 'rgba(239, 68, 68, 0.95)' : 'rgba(30, 41, 59, 0.95)'};
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            padding: 8px 18px;
            border-radius: 20px;
            border: 1px solid ${isSuccess ? '#f87171' : '#475569'};
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px ${isSuccess ? 'rgba(239, 68, 68, 0.4)' : 'transparent'};
            animation: toastPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }

    // === シミュレーション制御 ===
    toggleSimulation() {
        if (this.simTimer) {
            this.pauseSimulation();
        } else {
            this.startSimulation();
        }
    }

    startSimulation() {
        if (this.grid.placedItems.length === 0) {
            alert('盤面にアイテムを配置してください！');
            return;
        }

        this.dom.statusIndicator.textContent = '⚡ 戦闘シミュレーション実行中...';
        this.dom.statusIndicator.style.color = '#ef4444';
        this.dom.btnStartSim.textContent = '⏸ 一時停止';
        this.dom.btnStartSim.classList.remove('btn-primary');
        this.dom.btnStartSim.classList.add('btn-danger');
        this.dom.btnResetSim.disabled = false;
        this.dom.btnSubmitScore.disabled = true;

        if (!this.simState) {
            const sim = new BattleSimulator(this.grid, this.battleDuration);
            this.simState = sim.initializeState();
            this.simTimePoints = [];
            this.dom.battleLogs.innerHTML = '';
            this.simAccumulator = 0;
            this.updateSimStatusUI(0.0);
            this.clearChart();
        }

        const sim = new BattleSimulator(this.grid, this.battleDuration);
        const dt = sim.dt; // 0.01s (10ms) 固定刻み幅

        this.lastSimFrameTime = performance.now();

        // 20ms間隔 (50Hz) でタイマー実行し、経過実時間 × 速度倍率 分のサブステップを消化
        const frameIntervalMs = 20;

        this.simTimer = setInterval(() => {
            const now = performance.now();
            let realElapsedSec = (now - this.lastSimFrameTime) / 1000;
            this.lastSimFrameTime = now;

            // スパイク防止（タブ切り替えや一時的フリーズ等による急進を最大0.15秒に制限）
            realElapsedSec = Math.min(realElapsedSec, 0.15);

            // 現在設定されている速度倍率 (simSpeed) に応じて進行時間を累積
            this.simAccumulator += realElapsedSec * this.simSpeed;

            let stepped = false;
            // 固定刻み幅 dt (0.01s) 単位で正確に消化（サブステップ）
            while (this.simAccumulator >= dt) {
                this.simAccumulator -= dt;
                const currentTime = Math.round((this.simState.currentTime + dt) * 100) / 100;

                if (currentTime > this.battleDuration) {
                    this.completeSimulation();
                    return;
                }

                sim.stepSimulation(this.simState, dt, currentTime, null, (event) => {
                    this.handleBattleEvent(event);
                });

                stepped = true;

                // 0.2秒ごとにグラフ記録
                if (Math.round(currentTime * 100) % 20 === 0) {
                    this.simTimePoints.push({
                        time: currentTime,
                        heat: this.simState.buffs.heat
                    });
                }
            }

            if (stepped) {
                this.updateSimStatusUI(this.simState.currentTime);
                this.drawChart(this.simTimePoints);
            }

        }, frameIntervalMs);
    }

    pauseSimulation() {
        if (this.simTimer) {
            clearInterval(this.simTimer);
            this.simTimer = null;
        }
        this.dom.statusIndicator.textContent = '一時停止中';
        this.dom.statusIndicator.style.color = '#f59e0b';
        this.dom.btnStartSim.textContent = '▶ 再開';
        this.dom.btnStartSim.classList.add('btn-primary');
        this.dom.btnStartSim.classList.remove('btn-danger');
    }

    completeSimulation() {
        this.pauseSimulation();
        this.simAccumulator = 0;
        this.dom.statusIndicator.textContent = `✅ 検証完了 (${this.battleDuration.toFixed(1)}s)`;
        this.dom.statusIndicator.style.color = '#10b981';

        // 再検証機能は削除し、戦闘開始ボタンに戻す
        this.dom.btnStartSim.textContent = `▶ 戦闘開始 (${this.battleDuration}秒)`;
        this.dom.btnStartSim.classList.add('btn-primary');
        this.dom.btnStartSim.classList.remove('btn-danger');
        this.dom.btnResetSim.disabled = false;
        this.dom.btnSubmitScore.disabled = false;

        this.lastSimResult = {
            finalHeat: this.simState.buffs.heat,
            finalMana: this.simState.mana,
            staminaMisses: this.simState.staminaMisses,
            manaMisses: this.simState.manaMisses || 0,
            buffs: { ...this.simState.buffs }
        };

        this.displayFinalResult(this.lastSimResult);

        // 次回「戦闘開始」を押した時に0秒から新しくスタートするように状態をリセット
        this.simState = null;
    }

    runInstantSimulation() {
        if (this.grid.placedItems.length === 0) {
            alert('盤面にアイテムを配置してください！');
            return;
        }

        this.resetSimulation();

        const sim = new BattleSimulator(this.grid, this.battleDuration);
        const result = sim.runFullSimulation();

        this.lastSimResult = result;
        this.displayFinalResult(result);

        // ログ出力
        this.dom.battleLogs.innerHTML = '';
        for (const l of result.logs.slice(-30)) {
            const row = document.createElement('div');
            row.className = 'log-entry';
            row.innerHTML = `<span class="log-time">[${l.time}s]</span> <span class="log-text"><strong>${l.title}</strong>: ${l.detail}</span>`;
            this.dom.battleLogs.appendChild(row);
        }
        this.dom.battleLogs.scrollTop = this.dom.battleLogs.scrollHeight;

        // グラフ描画
        this.drawChart(result.timeSeries);

        // UI表示
        this.dom.valTimer.textContent = `${this.battleDuration.toFixed(1)}s`;
        if (this.dom.valHeat) this.dom.valHeat.textContent = result.finalHeat;
        if (this.dom.labelHeat) this.dom.labelHeat.textContent = result.finalHeat;
        if (this.dom.subHeat) this.dom.subHeat.textContent = `CD短縮: +${(result.finalHeat * 2)}%`;
        this.dom.valMana.textContent = result.finalMana;
        if (this.dom.labelMana) this.dom.labelMana.textContent = result.finalMana;
        this.dom.barMana.style.width = `${Math.min(100, result.finalMana * 5)}%`;
        if (this.dom.cardManaMisses) {
            this.dom.cardManaMisses.textContent = `マナ不足: ${result.manaMisses || 0}回`;
            this.dom.cardManaMisses.classList.toggle('has-misses', (result.manaMisses || 0) > 0);
        }
        this.dom.valStamina.textContent = result.finalStamina.toFixed(1);
        this.dom.barStamina.style.width = `${(result.finalStamina / (5.0 + this.grid.placedBags.filter(b => b.itemId === 'stamina_bag').length)) * 100}%`;
        if (this.dom.cardStaminaMisses) {
            this.dom.cardStaminaMisses.textContent = `スタミナ不足: ${result.staminaMisses}回`;
            this.dom.cardStaminaMisses.classList.toggle('has-misses', result.staminaMisses > 0);
        }

        this.dom.statusIndicator.textContent = '⚡ 即時計算完了';
        this.dom.statusIndicator.style.color = '#10b981';
        this.dom.btnSubmitScore.disabled = false;
        this.dom.btnResetSim.disabled = false;
    }

    resetSimulation() {
        this.pauseSimulation();
        this.simState = null;
        this.simAccumulator = 0;
        this.simTimePoints = [];
        this.dom.valTimer.textContent = '00.0s';
        this.dom.statusIndicator.textContent = '待機中';
        this.dom.statusIndicator.style.color = '#38bdf8';
        this.dom.btnStartSim.textContent = `▶ 戦闘開始 (${this.battleDuration}秒)`;
        this.dom.btnStartSim.classList.add('btn-primary');
        this.dom.btnStartSim.classList.remove('btn-danger');
        this.dom.btnResetSim.disabled = true;
        this.dom.btnSubmitScore.disabled = true;

        if (this.dom.valHeat) this.dom.valHeat.textContent = '0';
        if (this.dom.labelHeat) this.dom.labelHeat.textContent = '0';
        if (this.dom.subHeat) this.dom.subHeat.textContent = 'CD短縮: +0%';
        this.dom.valMana.textContent = '0';
        if (this.dom.labelMana) this.dom.labelMana.textContent = '0';
        this.dom.barMana.style.width = '0%';
        if (this.dom.cardManaMisses) {
            this.dom.cardManaMisses.textContent = 'マナ不足: 0回';
            this.dom.cardManaMisses.classList.remove('has-misses');
        }

        if (this.dom.bHeat) this.dom.bHeat.textContent = '0';
        if (this.dom.bMana) this.dom.bMana.textContent = '0';
        if (this.dom.bRegen) this.dom.bRegen.textContent = '0';
        if (this.dom.bLuck) this.dom.bLuck.textContent = '0';
        if (this.dom.bSpikes) this.dom.bSpikes.textContent = '0';
        if (this.dom.bVamp) this.dom.bVamp.textContent = '0';
        if (this.dom.bEmpower) this.dom.bEmpower.textContent = '0';

        const staminaBagCount = this.grid.placedBags.filter(b => b.itemId === 'stamina_bag').length;
        const maxStamina = 5.0 + staminaBagCount * 1.0;
        this.dom.valStamina.textContent = maxStamina.toFixed(1);
        this.dom.barStamina.style.width = '100%';
        if (this.dom.cardStaminaMisses) {
            this.dom.cardStaminaMisses.textContent = 'スタミナ不足: 0回';
            this.dom.cardStaminaMisses.classList.remove('has-misses');
        }

        this.clearChart();
    }

    updateSimStatusUI(time) {
        this.dom.valTimer.textContent = `${time.toFixed(1)}s`;
        if (this.dom.valHeat) this.dom.valHeat.textContent = this.simState.buffs.heat;
        if (this.dom.labelHeat) this.dom.labelHeat.textContent = this.simState.buffs.heat;
        if (this.dom.subHeat) this.dom.subHeat.textContent = `CD短縮: +${(this.simState.buffs.heat * 2)}%`;

        this.dom.valMana.textContent = this.simState.mana;
        if (this.dom.labelMana) this.dom.labelMana.textContent = this.simState.mana;
        this.dom.barMana.style.width = `${Math.min(100, this.simState.mana * 5)}%`;
        if (this.dom.cardManaMisses) {
            this.dom.cardManaMisses.textContent = `マナ不足: ${this.simState.manaMisses || 0}回`;
            this.dom.cardManaMisses.classList.toggle('has-misses', (this.simState.manaMisses || 0) > 0);
        }

        this.dom.valStamina.textContent = this.simState.stamina.toFixed(1);
        this.dom.barStamina.style.width = `${(this.simState.stamina / this.simState.maxStamina) * 100}%`;
        if (this.dom.cardStaminaMisses) {
            this.dom.cardStaminaMisses.textContent = `スタミナ不足: ${this.simState.staminaMisses || 0}回`;
            this.dom.cardStaminaMisses.classList.toggle('has-misses', (this.simState.staminaMisses || 0) > 0);
        }

        if (this.dom.bHeat) this.dom.bHeat.textContent = this.simState.buffs.heat || 0;
        if (this.dom.bMana) this.dom.bMana.textContent = this.simState.mana || 0;
        if (this.dom.bRegen) this.dom.bRegen.textContent = this.simState.buffs.regen || 0;
        if (this.dom.bLuck) this.dom.bLuck.textContent = this.simState.buffs.luck || 0;
        if (this.dom.bSpikes) this.dom.bSpikes.textContent = this.simState.buffs.spikes || 0;
        if (this.dom.bVamp) this.dom.bVamp.textContent = this.simState.buffs.vampirism || 0;
        if (this.dom.bEmpower) this.dom.bEmpower.textContent = this.simState.buffs.empower || 0;
    }

    handleBattleEvent(event) {
        // 発動アニメーション (Bounce)
        const el = document.getElementById(`item_${event.instanceId}`);
        if (el) {
            if (event.type === 'proc' || event.type === 'proc_mega') {
                el.classList.remove('bounce');
                void el.offsetWidth; // リフロー強制
                el.classList.add('bounce');
            } else if (event.type === 'miss') {
                el.classList.remove('miss-shake');
                void el.offsetWidth;
                el.classList.add('miss-shake');
            }
        }

        // ログ
        const row = document.createElement('div');
        row.className = 'log-entry';
        row.innerHTML = `<span class="log-time">[${this.simState.currentTime.toFixed(2)}s]</span> <span class="log-text">${event.name} ${event.type === 'miss' ? '❌ スタミナ不足！' : '⚡ 発動'}</span>`;
        this.dom.battleLogs.appendChild(row);
        if (this.dom.battleLogs.children.length > 80) {
            this.dom.battleLogs.removeChild(this.dom.battleLogs.firstChild);
        }
        this.dom.battleLogs.scrollTop = this.dom.battleLogs.scrollHeight;
    }

    displayFinalResult(result) {
        this.dom.resFinalHeat.textContent = result.finalHeat;
        if (this.dom.resStaminaMisses) {
            this.dom.resStaminaMisses.textContent = `スタミナ不足: ${result.staminaMisses}回 / マナ不足: ${result.manaMisses || 0}回`;
        }

        this.dom.bHeat.textContent = result.buffs.heat || 0;
        if (this.dom.bMana) this.dom.bMana.textContent = (result.buffs && result.buffs.mana != null) ? result.buffs.mana : (result.finalMana || 0);
        this.dom.bRegen.textContent = result.buffs.regen || 0;
        this.dom.bLuck.textContent = result.buffs.luck || 0;
        this.dom.bSpikes.textContent = result.buffs.spikes || 0;
        this.dom.bVamp.textContent = result.buffs.vampirism || 0;
        this.dom.bEmpower.textContent = result.buffs.empower || 0;
    }

    // === グラフ描画 (Canvas) ===
    initChart() {
        this.ctx = this.dom.heatChart.getContext('2d');
        this.resizeChart();
        window.addEventListener('resize', () => this.resizeChart());
    }

    resizeChart() {
        const rect = this.dom.heatChart.parentElement.getBoundingClientRect();
        this.dom.heatChart.width = rect.width - 16;
        this.dom.heatChart.height = rect.height - 16;
        this.clearChart();
    }

    clearChart() {
        if (!this.ctx) return;
        const w = this.dom.heatChart.width;
        const h = this.dom.heatChart.height;
        this.ctx.clearRect(0, 0, w, h);

        // ガイドライン
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let i = 1; i <= 3; i++) {
            const y = (h / 4) * i;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
        }
        this.ctx.stroke();

        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '10px JetBrains Mono';
        this.ctx.fillText('0s', 4, h - 4);
        this.ctx.fillText(`${Math.round(this.battleDuration / 2)}s`, w / 2 - 10, h - 4);
        this.ctx.fillText(`${Math.round(this.battleDuration)}s`, w - 24, h - 4);
    }

    drawChart(points) {
        if (!this.ctx || points.length === 0) return;
        const w = this.dom.heatChart.width;
        const h = this.dom.heatChart.height;

        this.clearChart();

        const maxHeat = Math.max(20, ...points.map(p => p.heat));

        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();

        points.forEach((p, idx) => {
            const x = (p.time / this.battleDuration) * (w - 30) + 10;
            const y = h - 16 - (p.heat / maxHeat) * (h - 26);
            if (idx === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();

        // 最後の点
        const last = points[points.length - 1];
        const lastX = (last.time / this.battleDuration) * (w - 30) + 10;
        const lastY = h - 16 - (last.heat / maxHeat) * (h - 26);

        this.ctx.fillStyle = '#f59e0b';
        this.ctx.beginPath();
        this.ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillText(`${last.heat} heat`, Math.min(w - 50, lastX - 10), Math.max(14, lastY - 8));
    }

    // === リーダーボード処理 ===
    submitScore() {
        if (!this.lastSimResult) return;
        const playerName = this.dom.inputPlayerName.value.trim() || '名無し職人';
        const ch = this.challenges.getActiveChallenge();
        const gridData = this.grid.serialize();

        this.leaderboard.addScore(ch.id, playerName, this.lastSimResult, gridData);
        this.dom.btnSubmitScore.disabled = true;
        alert(`スコア [ヒート: ${this.lastSimResult.finalHeat}] をランキングに登録しました！`);
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    renderLeaderboard() {
        const ch = this.challenges.getActiveChallenge();
        const rankings = this.leaderboard.getRankings(ch.id);
        const isAdmin = this.leaderboard.isAdmin();

        // クラウドステータスバッジの更新
        this.renderCloudStatus();

        // 管理者UIのトグル状態更新
        if (this.dom.btnAdminAuth) {
            this.dom.btnAdminAuth.style.display = isAdmin ? 'none' : 'inline-block';
        }
        if (this.dom.badgeAdminMode) {
            this.dom.badgeAdminMode.style.display = isAdmin ? 'inline-flex' : 'none';
        }

        this.dom.leaderboardList.innerHTML = '';

        if (rankings.length === 0) {
            this.dom.leaderboardList.innerHTML = `
                <div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 20px;">
                    この設問のスコアはまだありません
                </div>
            `;
            return;
        }

        rankings.forEach((entry, idx) => {
            const div = document.createElement('div');
            div.className = `lb-entry ${idx === 0 ? 'top-1' : ''}`;

            // 管理者モード時のみ削除ボタン [🗑️] を描画
            const deleteBtnHtml = isAdmin
                ? `<button class="btn btn-delete-score" style="padding: 2px 5px; font-size: 10px;" title="【管理者】このスコアを削除">🗑️</button>`
                : '';

            const safePlayerName = this.escapeHtml(entry.playerName || '名無し職人');
            const safeTimestamp = this.escapeHtml(entry.timestamp || '不明');

            div.innerHTML = `
                <div class="lb-rank">${idx === 0 ? '👑 1' : `#${idx + 1}`}</div>
                <div class="lb-name" title="登録日時: ${safeTimestamp}">${safePlayerName}</div>
                <div class="lb-score">${entry.heat} 🔥</div>
                <div class="lb-actions">
                    <button class="btn btn-restore-placement" style="padding: 2px 6px; font-size: 10px;" title="この配置を盤面に復元">配置</button>
                    ${deleteBtnHtml}
                </div>
            `;

            div.querySelector('.btn-restore-placement').addEventListener('click', () => {
                if (confirm(`「${entry.playerName}」さんの配置 (ヒート: ${entry.heat}) を盤面に復元しますか？`)) {
                    this.grid.deserialize(entry.gridData);
                    this.resetSimulation();
                }
            });

            if (isAdmin) {
                const btnDel = div.querySelector('.btn-delete-score');
                if (btnDel) {
                    btnDel.addEventListener('click', () => {
                        if (confirm(`【管理者】「${entry.playerName}」さんのスコア（ヒート: ${entry.heat}🔥 / 登録日時: ${entry.timestamp || '不明'}）をランキングから削除しますか？`)) {
                            this.leaderboard.deleteScore(ch.id, entry.id);
                        }
                    });
                }
            }

            this.dom.leaderboardList.appendChild(div);
        });
    }

    /**
     * クラウド同期ステータスバッジの描画
     */
    renderCloudStatus() {
        if (!this.dom.badgeCloudStatus || !this.leaderboard) return;
        const statusObj = this.leaderboard.getCloudStatus();
        this.dom.badgeCloudStatus.className = `badge-cloud-status status-${statusObj.status}`;

        if (statusObj.status === 'connected') {
            this.dom.badgeCloudStatus.innerHTML = `🌐 世界同期中`;
            this.dom.badgeCloudStatus.title = '世界中のプレイヤーとスコアがリアルタイム同期されています（クリックで詳細）';
        } else if (statusObj.status === 'connecting') {
            this.dom.badgeCloudStatus.innerHTML = `🔄 接続中...`;
            this.dom.badgeCloudStatus.title = 'クラウドサーバー（Firestore）に接続しています...';
        } else if (statusObj.status === 'error') {
            this.dom.badgeCloudStatus.innerHTML = `❌ 同期エラー`;
            this.dom.badgeCloudStatus.title = `同期エラー: ${statusObj.message || '詳細を確認'}（クリック）`;
        } else {
            this.dom.badgeCloudStatus.innerHTML = `⚠️ ローカル保存中`;
            this.dom.badgeCloudStatus.title = 'お使いのブラウザ内部にのみ保存されています。クリックして世界公開の設定方法を確認';
        }
    }

    /**
     * クラウド同期案内モーダルを開く
     */
    openCloudSyncModal() {
        if (!this.dom.modalCloudSync) return;
        const statusObj = this.leaderboard ? this.leaderboard.getCloudStatus() : { status: 'local' };

        let contentHtml = '';
        if (statusObj.status === 'connected') {
            contentHtml = `
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #34d399; font-weight: 700; font-size: 14px; margin-bottom: 4px;">
                        <span>✅ 世界リアルタイム共有が稼働中</span>
                    </div>
                    <div style="color: #cbd5e1; font-size: 12px; line-height: 1.5;">
                        Firebase Firestore クラウドデータベースと接続されています。<br>
                        あなたが登録したスコアや、他のプレイヤーが世界中から登録したスコアは、リアルタイムに全ユーザーの画面に自動同期されます！
                    </div>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
                    ・同率スコア時は、先に登録したプレイヤーが上位（先着順）となります。<br>
                    ・Firestoreのスコアはブラウザにもキャッシュされるため、オフライン時でも高速に読み込まれます。<br>
                    ・悪質なスコアは管理者パスコードで個別に削除可能です。
                </div>
            `;
        } else if (statusObj.status === 'error') {
            contentHtml = `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #f87171; font-weight: 700; font-size: 14px; margin-bottom: 4px;">
                        <span>❌ クラウド同期エラーが発生しました</span>
                    </div>
                    <div style="color: #cbd5e1; font-size: 12px; line-height: 1.5;">
                        ${statusObj.message || 'Firebase Firestoreへのアクセスに失敗しました。'}
                    </div>
                </div>
                <div style="background: var(--bg-panel-sub); padding: 12px; border-radius: 6px; font-size: 12px; color: var(--text-primary); line-height: 1.6;">
                    <strong>考えられる原因と対処法:</strong><br>
                    1. <strong>Firestoreのセキュリティルールで拒否されている場合</strong>:<br>
                    Firebase Console の「Firestore Database」→「ルール」タブで、読み書きが許可されているか確認してください。<br>
                    <pre style="background: #0f172a; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 11px; overflow-x: auto; color: #67e8f9;">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{challengeId}/scores/{scoreId} {
      allow read, write: if true;
    }
  }
}</pre>
                    2. <strong>APIキーやプロジェクトIDの誤り</strong>:<br>
                    <code>js/firebase-config.js</code> に貼り付けた設定値が正しいかご確認ください。
                </div>
            `;
        } else {
            contentHtml = `
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #fbbf24; font-weight: 700; font-size: 14px; margin-bottom: 4px;">
                        <span>⚠️ 現在、個人ローカル保存モードです</span>
                    </div>
                    <div style="color: #cbd5e1; font-size: 12px; line-height: 1.5;">
                        Firebase Firestore（無料クラウドDB）が設定されていないため、スコアはお使いのブラウザ内部（localStorage）にのみ保存されています。<br>
                        <strong>そのため、他の人が追加したスコアは反映されず、自分のスコアも世界に公開されていません。</strong>
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <strong style="color: #67e8f9; font-size: 13px;">🚀 世界ランキングに公開する3ステップ（所要3分・完全無料）</strong>
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px; color: var(--text-primary); line-height: 1.5;">
                    <div style="background: var(--bg-panel-sub); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #38bdf8;">
                        <strong>① Firebase Console で無料プロジェクトを作成</strong><br>
                        <a href="https://console.firebase.google.com/" target="_blank" rel="noopener" style="color: #38bdf8; text-decoration: underline;">https://console.firebase.google.com/</a> にアクセスし、「プロジェクトを追加」を押します（クレジットカード不要・無料プランSparkでOK）。
                    </div>
                    <div style="background: var(--bg-panel-sub); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #38bdf8;">
                        <strong>② Cloud Firestore データベースを作成</strong><br>
                        左メニュー「構築」→「Firestore Database」を選び、「データベースの作成」を押します。<br>
                        最初のルールは「<strong>テストモードで開始</strong>」を選び、ロケーションは「asia-northeast1 (東京)」などを推奨します。
                    </div>
                    <div style="background: var(--bg-panel-sub); padding: 10px 12px; border-radius: 6px; border-left: 3px solid #38bdf8;">
                        <strong>③ Webアプリ設定を <code>js/firebase-config.js</code> に貼り付け</strong><br>
                        プロジェクト概要の歯車アイコン「プロジェクトの設定」→「マイアプリ」の「ウェブ（&lt;/&gt;）」を追加します。<br>
                        表示された <code>firebaseConfig</code> オブジェクトの各項目を、プロジェクト内の <code>js/firebase-config.js</code> に貼り付けて保存し、GitHubにPushすれば世界共有が即時有効化されます！
                    </div>
                </div>

                <div style="margin-top: 14px; padding: 10px; background: rgba(56, 189, 248, 0.08); border-radius: 6px; font-size: 11px; color: #94a3b8;">
                    💡 詳しい手順やFirestoreのルール設定は <code>README.md</code> にも分かりやすくまとめてあります。
                </div>
            `;
        }

        if (this.dom.modalCloudSyncBody) {
            this.dom.modalCloudSyncBody.innerHTML = contentHtml;
        }
        this.dom.modalCloudSync.style.display = 'flex';
    }

    /**
     * クラウド同期案内モーダルを閉じる
     */
    closeCloudSyncModal() {
        if (this.dom.modalCloudSync) {
            this.dom.modalCloudSync.style.display = 'none';
        }
    }

    /**
     * 1位の配置をワンクリックで復元
     */
    restoreTopPlacement() {
        const ch = this.challenges.getActiveChallenge();
        const top = this.leaderboard.getTopEntry(ch.id);
        if (!top) {
            alert('この設問にはまだ1位の記録がありません！');
            return;
        }

        if (confirm(`👑 1位「${top.playerName}」さんの配置 (ヒート: ${top.heat}) を盤面に復元しますか？`)) {
            this.grid.deserialize(top.gridData);
            this.resetSimulation();
        }
    }

    // === 設問編集モーダル ===
    openChallengeModal() {
        const ch = this.challenges.getActiveChallenge();
        this.dom.mChallengeId.value = ch.id;
        this.dom.mChallengeName.value = ch.name;
        this.dom.mChallengeDesc.value = ch.description;
        this.dom.mChallengeMode.value = ch.mode;
        this.dom.mBagLimitsGroup.style.display = ch.mode === 'bag' ? 'block' : 'none';

        this.dom.mLimitEgg.value = ch.itemLimits.eggscalibur ?? 1;
        this.dom.mLimitChili.value = ch.itemLimits.chili ?? 8;
        this.dom.mLimitBanana.value = ch.itemLimits.banana ?? 4;
        this.dom.mLimitCupcake.value = ch.itemLimits.cupcake ?? 3;
        this.dom.mLimitManaOrb.value = ch.itemLimits.mana_orb ?? 3;

        this.dom.mLimitLeather.value = ch.bagLimits?.leather_bag ?? 4;
        this.dom.mLimitFanny.value = ch.bagLimits?.fanny_pack ?? 3;
        this.dom.mLimitStamina.value = ch.bagLimits?.stamina_bag ?? 2;

        this.dom.challengeModal.classList.add('open');
    }

    closeChallengeModal() {
        this.dom.challengeModal.classList.remove('open');
    }

    saveChallengeFromModal() {
        const id = this.dom.mChallengeId.value.trim() || 'pattern_' + Date.now();
        const name = this.dom.mChallengeName.value.trim() || '新規パターン';
        const description = this.dom.mChallengeDesc.value.trim();
        const mode = this.dom.mChallengeMode.value;

        const challenge = {
            id,
            name,
            description,
            mode,
            itemLimits: {
                eggscalibur: parseInt(this.dom.mLimitEgg.value) || 0,
                chili: parseInt(this.dom.mLimitChili.value) || 0,
                banana: parseInt(this.dom.mLimitBanana.value) || 0,
                cupcake: parseInt(this.dom.mLimitCupcake.value) || 0,
                mana_orb: parseInt(this.dom.mLimitManaOrb.value) || 0
            },
            bagLimits: mode === 'bag' ? {
                leather_bag: parseInt(this.dom.mLimitLeather.value) || 0,
                fanny_pack: parseInt(this.dom.mLimitFanny.value) || 0,
                stamina_bag: parseInt(this.dom.mLimitStamina.value) || 0
            } : {
                leather_bag: 0,
                fanny_pack: 0,
                stamina_bag: 0
            }
        };

        this.challenges.addOrUpdateChallenge(challenge);
        this.closeChallengeModal();
    }

    deleteChallengeFromModal() {
        const ch = this.challenges.getActiveChallenge();
        if (confirm(`設問「${ch.name}」を削除しますか？`)) {
            if (this.challenges.deleteChallenge(ch.id)) {
                this.closeChallengeModal();
            } else {
                alert('設問が1つしかないため削除できません。');
            }
        }
    }
}

    function init() {
        window.app = new App();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
