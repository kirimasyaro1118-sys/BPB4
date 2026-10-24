// Backpack Battles - 50秒間動的戦闘シミュレーションエンジン
(function() {
    const ITEMS = window.ITEMS;
    const ITEM_TYPES = window.ITEM_TYPES;

class BattleSimulator {
    constructor(gridState, duration = 50.0) {
        this.gridState = gridState;
        this.duration = duration; // 戦闘時間（デフォルト50.0秒）
        this.dt = 0.01; // 10ms刻み
    }

    /**
     * シミュレーションを一括実行し、全時系列データと最終スコアを返す
     */
    runFullSimulation() {
        const state = this.initializeState();
        const logs = [];
        const timeSeries = []; // グラフ用データ: { time, heat, mana, stamina, buffCount }

        const totalSteps = Math.round(this.duration / this.dt);

        for (let step = 0; step <= totalSteps; step++) {
            const currentTime = Math.round(step * this.dt * 100) / 100;

            // 0.1秒ごとに時系列データを記録
            if (step % 10 === 0 || step === totalSteps) {
                timeSeries.push({
                    time: currentTime,
                    heat: state.buffs.heat,
                    mana: state.mana,
                    stamina: Math.round(state.stamina * 10) / 10,
                    totalBuffs: Object.values(state.buffs).reduce((a, b) => a + b, 0)
                });
            }

            if (step < totalSteps) {
                this.stepSimulation(state, this.dt, currentTime, logs);
            }
        }

        return {
            finalHeat: state.buffs.heat,
            finalMana: state.mana,
            finalStamina: state.stamina,
            buffs: { ...state.buffs, mana: state.mana },
            totalProcs: state.procCounts,
            staminaMisses: state.staminaMisses,
            manaMisses: state.manaMisses,
            timeSeries,
            logs
        };
    }

    /**
     * 初期状態の構築
     */
    initializeState() {
        // スタミナバッグのカウント
        const staminaBagCount = this.gridState.placedBags.filter(b => b.itemId === 'stamina_bag').length;
        const maxStamina = 5.0 + (staminaBagCount * 1.0);

        // 配置された各アイテムのランタイムインスタンス作成
        const runtimeItems = this.gridState.placedItems.map(item => {
            const def = ITEMS[item.itemId];
            // このアイテムがウエストポーチに乗っているマス数を計算
            const fannyCells = this.gridState.countFannyPackCellsForItem(item);
            const speedBonusFromBag = fannyCells * (ITEMS.fanny_pack.cooldownSpeedBonusPerCell || 0.10);

            // 食べ物アイテム共通効果:
            // 自身と種類の違う食べ物と隣接している場合、その数(種類ではない)だけ10％加速
            let foodSpeedBonus = 0;
            let adjacentDiffFoods = [];
            if (def.type === ITEM_TYPES.FOOD && typeof this.gridState.getAdjacentDifferentFoods === 'function') {
                adjacentDiffFoods = this.gridState.getAdjacentDifferentFoods(item);
                foodSpeedBonus = adjacentDiffFoods.length * 0.10;
            }

            return {
                instanceId: item.instanceId,
                itemId: item.itemId,
                def,
                placedItem: item,
                fannyCells,
                speedBonusFromBag,
                foodSpeedBonus,
                adjacentDiffFoodCount: adjacentDiffFoods.length,
                progress: 0.0, // クールダウン経過秒数
                manaOrbProcCount: 0, // マナオーブ用星発動回数
                thresholdTriggered: false // 35マナ1回限定効果フラグ
            };
        });

        return {
            currentTime: 0.0,
            mana: 0,
            stamina: maxStamina,
            maxStamina,
            staminaRegenPerSec: 1.0,
            buffs: {
                heat: 0,
                regen: 0,
                luck: 0,
                spikes: 0,
                vampirism: 0,
                empower: 0
            },
            runtimeItems,
            procCounts: {},
            staminaMisses: 0,
            manaMisses: 0
        };
    }

    /**
     * 1ステップ（dt秒）の進行
     */
    stepSimulation(state, dt, currentTime, logs = null, onEvent = null) {
        state.currentTime = currentTime;

        // 1. スタミナ自然回復 (1秒あたり1回復、最大値まで)
        state.stamina = Math.min(state.maxStamina, state.stamina + (state.staminaRegenPerSec * dt));

        // 現在のヒート数に基づくクールダウン加速倍率
        // 1スタックにつき+2%
        const heatSpeedBonus = state.buffs.heat * 0.02;

        // 発動キュー（同時発動順序を管理）
        const readyItems = [];

        // 2. 各アイテムのクールダウン進行
        for (const item of state.runtimeItems) {
            if (!item.def.baseCooldown) continue; // マナオーブ等はパッシブ

            // アイテムの総合速度倍率
            // 加速効果（ヒート・バッグ・隣接食べ物）は加算で累積
            // 例: 2個隣接(+20%)と30ヒート(+60%) -> 10×2 ＋ 2×30 = 80%加速 (総合倍率 1.80)
            const totalSpeedMultiplier = 1.0 + heatSpeedBonus + item.speedBonusFromBag + (item.foodSpeedBonus || 0);
            item.progress += dt * totalSpeedMultiplier;

            if (item.progress >= item.def.baseCooldown) {
                readyItems.push(item);
            }
        }

        // 3. 発動判定
        for (const item of readyItems) {
            this.triggerItem(item, state, currentTime, logs, onEvent);
        }
    }

    /**
     * アイテムの通常発動処理
     */
    triggerItem(item, state, currentTime, logs = null, onEvent = null) {
        const itemId = item.itemId;

        if (itemId === 'eggscalibur') {
            // エッグスカリバーの攻撃処理
            const cost = item.def.staminaCost || 1.3;
            if (state.stamina >= cost) {
                // 発動成功
                state.stamina -= cost;
                item.progress = 0.0;
                state.procCounts[item.instanceId] = (state.procCounts[item.instanceId] || 0) + 1;

                this.log(logs, currentTime, '🍳 エッグスカリバー攻撃！', `スタミナ1.3消費 (残り: ${state.stamina.toFixed(1)})`);
                if (onEvent) onEvent({ type: 'proc', instanceId: item.instanceId, name: item.def.name });

                // ★スロットの食べ物強制起動判定（11マナ所持時）
                if (state.mana >= 11) {
                    state.mana -= 11;
                    this.log(logs, currentTime, '✨ エッグスカリバー覚醒発動！', `11マナ消費して★の全食べ物を強制起動！(残りマナ: ${state.mana})`);

                    // エッグスカリバーの星スロットに触れている「食べ物」アイテムを取得
                    const targetFoods = this.gridState.getStarredItems(item.placedItem, 'food');
                    
                    for (const foodItem of targetFoods) {
                        const foodRuntime = state.runtimeItems.find(r => r.instanceId === foodItem.instanceId);
                        if (foodRuntime) {
                            // 食べ物を強制起動
                            this.activateFood(foodRuntime, state, currentTime, logs, onEvent, true);
                        }
                    }
                } else {
                    // エッグスの効果を起動するためのマナ不足
                    state.manaMisses++;
                }

                // マナオーブの星判定（エッグスカリバーの発動を検知）
                this.checkManaOrbsTriggeredBy(item, state, currentTime, logs, onEvent);

            } else {
                // スタミナ不足！空振りしてCDリセット
                item.progress = 0.0;
                state.staminaMisses++;
                this.log(logs, currentTime, '⚠️ エッグスカリバー発動失敗', `スタミナ不足 (${state.stamina.toFixed(1)} < 1.3)。CDリセット！`);
                if (onEvent) onEvent({ type: 'miss', instanceId: item.instanceId, name: item.def.name });
            }
        } else if (item.def.type === ITEM_TYPES.FOOD) {
            // 食べ物の自発的クールダウン完了
            item.progress = 0.0;
            this.activateFood(item, state, currentTime, logs, onEvent, false);
        }
    }

    /**
     * 食べ物アイテムの発動効果実行
     */
    activateFood(foodItem, state, currentTime, logs = null, onEvent = null, isForcedByEggscalibur = false) {
        state.procCounts[foodItem.instanceId] = (state.procCounts[foodItem.instanceId] || 0) + 1;

        // エッグスカリバーによる強制起動時は、食べ物の自発的クールダウン進捗（progress）はリセットせず維持
        const prefix = isForcedByEggscalibur ? '⚡ [強制起動] ' : '🍎 ';

        if (foodItem.itemId === 'chili') {
            state.buffs.heat += 1;
            this.log(logs, currentTime, `${prefix}トウガラシ発動`, `ヒート+1獲得 (合計ヒート: ${state.buffs.heat})`);
            if (onEvent) onEvent({ type: 'proc', instanceId: foodItem.instanceId, name: foodItem.def.name, buff: 'heat' });

        } else if (foodItem.itemId === 'banana') {
            state.stamina = Math.min(state.maxStamina, state.stamina + 1.0);
            this.log(logs, currentTime, `${prefix}バナナ発動`, `スタミナ+1回復 (現在: ${state.stamina.toFixed(1)} / ${state.maxStamina})`);
            if (onEvent) onEvent({ type: 'proc', instanceId: foodItem.instanceId, name: foodItem.def.name, buff: 'stamina' });

        } else if (foodItem.itemId === 'cupcake') {
            // 最多バフ判定（リジェネ、ラック、トゲ、吸血、ヒート、エンパ）
            const buffKeys = ['heat', 'regen', 'luck', 'spikes', 'vampirism', 'empower'];
            let maxVal = -1;
            let maxBuffs = [];

            for (const key of buffKeys) {
                const val = state.buffs[key] || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxBuffs = [key];
                } else if (val === maxVal) {
                    maxBuffs.push(key);
                }
            }

            // 全て0または同数の場合はマナ2を獲得
            if (maxBuffs.length > 1 || maxVal === 0) {
                state.mana += 2;
                this.log(logs, currentTime, `${prefix}カップケーキ発動`, `最多バフが同数(各${maxVal})のためマナ+2獲得 (合計マナ: ${state.mana})`);
                if (onEvent) onEvent({ type: 'proc', instanceId: foodItem.instanceId, name: foodItem.def.name, buff: 'mana' });
            } else {
                const topBuff = maxBuffs[0];
                state.buffs[topBuff] += 2;
                this.log(logs, currentTime, `${prefix}カップケーキ発動`, `最多バフ[${topBuff}]に+2獲得 (合計: ${state.buffs[topBuff]})`);
                if (onEvent) onEvent({ type: 'proc', instanceId: foodItem.instanceId, name: foodItem.def.name, buff: topBuff });
            }
        } else if (foodItem.itemId === 'blueberry') {
            if (state.mana <= 9) {
                state.mana += 1;
                this.log(logs, currentTime, `${prefix}ブルーベリー発動`, `マナが9以下のためマナ+1獲得 (合計マナ: ${state.mana})`);
                if (onEvent) onEvent({ type: 'proc', instanceId: foodItem.instanceId, name: foodItem.def.name, buff: 'mana' });
            } else {
                state.buffs.luck += 1;
                this.log(logs, currentTime, `${prefix}ブルーベリー発動`, `マナが10以上(${state.mana})のためラック+1獲得 (合計ラック: ${state.buffs.luck})`);
                if (onEvent) onEvent({ type: 'proc', instanceId: foodItem.instanceId, name: foodItem.def.name, buff: 'luck' });
            }
        }

        // 食べ物の発動によってマナオーブの星判定をチェック
        this.checkManaOrbsTriggeredBy(foodItem, state, currentTime, logs, onEvent);
    }

    /**
     * 発動したアイテム（エッグスや食べ物）が、いずれかのマナオーブの★スロットに入っているか判定
     */
    checkManaOrbsTriggeredBy(triggeredItem, state, currentTime, logs = null, onEvent = null) {
        const manaOrbs = state.runtimeItems.filter(r => r.itemId === 'mana_orb');

        for (const orb of manaOrbs) {
            // triggeredItemがこのマナオーブの星スロットに触れているか確認
            const isTouching = this.gridState.isItemInStarsOf(triggeredItem.placedItem, orb.placedItem);
            if (isTouching) {
                orb.manaOrbProcCount++;
                // 2回に1回（偶数回目: 2, 4, 6...）マナ1獲得
                if (orb.manaOrbProcCount % 2 === 0) {
                    state.mana += 1;
                    this.log(logs, currentTime, '🔮 マナオーブ発動', `★アイテム発動2回目検知によりマナ+1獲得 (合計マナ: ${state.mana})`);
                    if (onEvent) onEvent({ type: 'proc', instanceId: orb.instanceId, name: orb.def.name, buff: 'mana' });

                    // 35マナ到達判定（1回のみ発動）
                    if (state.mana >= 35 && !orb.thresholdTriggered) {
                        orb.thresholdTriggered = true;
                        state.mana -= 35;
                        // マナ以外の全バフ+3獲得
                        const allBuffs = ['heat', 'regen', 'luck', 'spikes', 'vampirism', 'empower'];
                        for (const b of allBuffs) {
                            state.buffs[b] += 3;
                        }
                        this.log(logs, currentTime, '🌟 【マナオーブ覚醒】', `35マナ消費して全バフ+3を獲得！(ヒート: ${state.buffs.heat}, 残りマナ: ${state.mana})`);
                        if (onEvent) onEvent({ type: 'proc_mega', instanceId: orb.instanceId, name: 'マナオーブ覚醒' });
                    }
                }
            }
        }
    }

    log(logs, time, title, detail) {
        if (!logs) return;
        logs.push({
            time: time.toFixed(2),
            title,
            detail
        });
    }
}

    if (typeof window !== 'undefined') {
        window.BattleSimulator = BattleSimulator;
    }
})();

