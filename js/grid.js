// Backpack Battles - 9x7 バックパック盤面管理モジュール
(function() {
    const ITEMS = window.ITEMS;
    const ITEM_TYPES = window.ITEM_TYPES;
    const rotateShape = window.rotateShape;
    const rotateStarSlots = window.rotateStarSlots;
    const rotateItemWithStars = window.rotateItemWithStars;

class GridManager {
    constructor(cols = 9, rows = 7) {
        this.cols = cols;
        this.rows = rows;
        this.mode = 'free'; // 'free' (全マス解放) または 'bag' (バッグ配置必須)
        this.placedBags = [];  // { instanceId, itemId, col, row, rotation, coords }
        this.placedItems = []; // { instanceId, itemId, col, row, rotation, coords, starSlots }
        this.listeners = [];
    }

    onChange(listener) {
        this.listeners.push(listener);
    }

    notify() {
        for (const l of this.listeners) l(this);
    }

    setMode(mode) {
        this.mode = mode;
        this.notify();
    }

    clear() {
        this.placedBags = [];
        this.placedItems = [];
        this.notify();
    }

    /**
     * 回転後の相対マス座標と星スロット座標を計算
     */
    getTransformedCoords(itemId, rotation = 0) {
        const def = ITEMS[itemId];
        if (!def) return { shape: [], starSlots: [] };

        let shape = [...def.shape.map(c => [...c])];
        let starSlots = def.starSlots ? [...def.starSlots.map(c => [...c])] : [];

        // 90度回転を (rotation % 4) 回適用
        const turns = ((rotation % 4) + 4) % 4;
        for (let i = 0; i < turns; i++) {
            if (rotateItemWithStars) {
                const res = rotateItemWithStars(shape, starSlots);
                shape = res.shape;
                starSlots = res.starSlots;
            } else {
                shape = rotateShape(shape);
                starSlots = rotateStarSlots(starSlots);
            }
        }

        return { shape, starSlots };
    }

    /**
     * 指定された位置・回転でバッグタイルを配置できるか判定
     */
    canPlaceBag(itemId, col, row, rotation = 0, ignoreInstanceId = null) {
        const { shape } = this.getTransformedCoords(itemId, rotation);

        // 1. 盤面範囲内チェック
        for (const [dx, dy] of shape) {
            const x = col + dx;
            const y = row + dy;
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
                return false;
            }
        }

        // 2. 他のバッグとの重なりチェック
        for (const bag of this.placedBags) {
            if (ignoreInstanceId && bag.instanceId === ignoreInstanceId) continue;
            for (const [bx, by] of bag.coords) {
                for (const [dx, dy] of shape) {
                    if (bag.col + bx === col + dx && bag.row + by === row + dy) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * バッグの配置
     */
    placeBag(itemId, col, row, rotation = 0) {
        if (!this.canPlaceBag(itemId, col, row, rotation)) return null;

        const { shape } = this.getTransformedCoords(itemId, rotation);
        const bag = {
            instanceId: 'bag_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            itemId,
            col,
            row,
            rotation,
            coords: shape
        };

        this.placedBags.push(bag);
        this.notify();
        return bag;
    }

    /**
     * 指定位置にバッグが存在するか判定（モード'bag'時の下地チェック用）
     */
    isBagCovering(x, y) {
        if (this.mode === 'free') return true; // フリーモードなら全マス有効

        for (const bag of this.placedBags) {
            for (const [dx, dy] of bag.coords) {
                if (bag.col + dx === x && bag.row + dy === y) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 指定された位置・回転でアイテムを配置できるか判定
     */
    canPlaceItem(itemId, col, row, rotation = 0, ignoreInstanceId = null) {
        const { shape } = this.getTransformedCoords(itemId, rotation);

        for (const [dx, dy] of shape) {
            const x = col + dx;
            const y = row + dy;

            // 1. 盤面内か
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
                return false;
            }

            // 2. モード'bag'の場合、バッグタイルの上にあるか
            if (!this.isBagCovering(x, y)) {
                return false;
            }
        }

        // 3. 他のアイテムとの重複チェック
        for (const item of this.placedItems) {
            if (ignoreInstanceId && item.instanceId === ignoreInstanceId) continue;
            for (const [ix, iy] of item.coords) {
                for (const [dx, dy] of shape) {
                    if (item.col + ix === col + dx && item.row + iy === row + dy) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * アイテムの配置
     */
    placeItem(itemId, col, row, rotation = 0) {
        if (!this.canPlaceItem(itemId, col, row, rotation)) return null;

        const { shape, starSlots } = this.getTransformedCoords(itemId, rotation);
        const item = {
            instanceId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            itemId,
            col,
            row,
            rotation,
            coords: shape,
            starSlots
        };

        this.placedItems.push(item);
        this.notify();
        return item;
    }

    removeItem(instanceId) {
        this.placedItems = this.placedItems.filter(i => i.instanceId !== instanceId);
        this.notify();
    }

    removeBag(instanceId) {
        // バッグを削除する場合、そのバッグの上に載っているアイテムがあれば配置不可になる可能性があるためチェック
        this.placedBags = this.placedBags.filter(b => b.instanceId !== instanceId);

        if (this.mode === 'bag') {
            // 乗れなくなったアイテムを自動撤去
            const invalidItems = this.placedItems.filter(item => {
                for (const [dx, dy] of item.coords) {
                    if (!this.isBagCovering(item.col + dx, item.row + dy)) return true;
                }
                return false;
            });
            for (const inv of invalidItems) {
                this.removeItem(inv.instanceId);
            }
        }

        this.notify();
    }

    /**
     * アイテムの移動・回転
     */
    moveItem(instanceId, newCol, newRow, newRotation = null) {
        const item = this.placedItems.find(i => i.instanceId === instanceId);
        if (!item) return false;

        const rot = newRotation !== null ? newRotation : item.rotation;
        if (!this.canPlaceItem(item.itemId, newCol, newRow, rot, instanceId)) {
            return false;
        }

        const { shape, starSlots } = this.getTransformedCoords(item.itemId, rot);
        item.col = newCol;
        item.row = newRow;
        item.rotation = rot;
        item.coords = shape;
        item.starSlots = starSlots;

        this.notify();
        return true;
    }

    /**
     * バッグの移動・回転
     */
    moveBag(instanceId, newCol, newRow, newRotation = null) {
        const bag = this.placedBags.find(b => b.instanceId === instanceId);
        if (!bag) return false;

        const rot = newRotation !== null ? newRotation : bag.rotation;
        if (!this.canPlaceBag(bag.itemId, newCol, newRow, rot, instanceId)) {
            return false;
        }

        const { shape } = this.getTransformedCoords(bag.itemId, rot);
        bag.col = newCol;
        bag.row = newRow;
        bag.rotation = rot;
        bag.coords = shape;

        // バッグ移動に伴い、バッグからはみ出たアイテムがあれば自動撤去
        if (this.mode === 'bag') {
            const invalidItems = this.placedItems.filter(item => {
                for (const [dx, dy] of item.coords) {
                    if (!this.isBagCovering(item.col + dx, item.row + dy)) return true;
                }
                return false;
            });
            for (const inv of invalidItems) {
                this.removeItem(inv.instanceId);
            }
        }

        this.notify();
        return true;
    }

    /**
     * 配置済み全アイテムの一括移動（十字キー操作用）
     * @param {number} dCol 横移動量 (-1, 0, 1)
     * @param {number} dRow 縦移動量 (-1, 0, 1)
     * @returns {boolean} 移動が成功したかどうか（はみ出る場合はfalseで無反応）
     */
    shiftItems(dCol, dRow) {
        if (dCol === 0 && dRow === 0) return false;
        if (this.placedItems.length === 0) return false;

        // 1. 移動後に全アイテムの全マスが盤面内かつ（バッグモード時は）バッグ上にあるか事前チェック
        for (const item of this.placedItems) {
            for (const [dx, dy] of item.coords) {
                const targetX = item.col + dCol + dx;
                const targetY = item.row + dRow + dy;

                // 盤面境界チェック (9x7)
                if (targetX < 0 || targetX >= this.cols || targetY < 0 || targetY >= this.rows) {
                    return false; // 盤面外にはみ出るため無反応
                }

                // バッグ構築モード時: 移動先のマスにバッグが存在するか
                if (this.mode === 'bag' && !this.isBagCovering(targetX, targetY)) {
                    return false; // バッグ外にはみ出るため無反応
                }
            }
        }

        // 2. 全アイテムが安全に収まることを確認した上で、一括で座標を更新
        for (const item of this.placedItems) {
            item.col += dCol;
            item.row += dRow;
        }

        this.notify();
        return true;
    }

    /**
     * 配置済み全バッグの一括移動（バッグ移動モード時用）
     * @param {number} dCol 横移動量 (-1, 0, 1)
     * @param {number} dRow 縦移動量 (-1, 0, 1)
     * @returns {boolean} 移動が成功したかどうか（はみ出る場合はfalseで無反応）
     */
    shiftBags(dCol, dRow) {
        if (dCol === 0 && dRow === 0) return false;
        if (this.placedBags.length === 0) return false;

        // 1. 全バッグが盤面内に収まるか事前チェック
        for (const bag of this.placedBags) {
            for (const [dx, dy] of bag.coords) {
                const targetX = bag.col + dCol + dx;
                const targetY = bag.row + dRow + dy;
                if (targetX < 0 || targetX >= this.cols || targetY < 0 || targetY >= this.rows) {
                    return false; // 盤面外にはみ出るため無反応
                }
            }
        }

        // 2. もしアイテムも配置されている場合、アイテムも一緒に移動できるかチェック
        let canMoveItemsTogether = true;
        for (const item of this.placedItems) {
            for (const [dx, dy] of item.coords) {
                const targetX = item.col + dCol + dx;
                const targetY = item.row + dRow + dy;
                if (targetX < 0 || targetX >= this.cols || targetY < 0 || targetY >= this.rows) {
                    canMoveItemsTogether = false;
                    break;
                }
            }
            if (!canMoveItemsTogether) break;
        }

        // 全バッグを移動
        for (const bag of this.placedBags) {
            bag.col += dCol;
            bag.row += dRow;
        }

        // アイテムもはみ出さなければ一緒に移動
        if (canMoveItemsTogether) {
            for (const item of this.placedItems) {
                item.col += dCol;
                item.row += dRow;
            }
        } else {
            // アイテムが盤面外にはみ出してしまう場合はバッグだけ移動し、
            // 新しいバッグ範囲外になったアイテムを安全にクリーンアップ
            const invalidItems = this.placedItems.filter(item => {
                for (const [dx, dy] of item.coords) {
                    if (!this.isBagCovering(item.col + dx, item.row + dy)) return true;
                }
                return false;
            });
            for (const inv of invalidItems) {
                this.removeItem(inv.instanceId);
            }
        }

        this.notify();
        return true;
    }

    /**
     * 一括移動エントリーポイント
     * @param {number} dCol 横移動量 (-1, 0, 1)
     * @param {number} dRow 縦移動量 (-1, 0, 1)
     * @param {string} targetMode 'item' または 'bag'
     * @returns {boolean}
     */
    shiftAll(dCol, dRow, targetMode = 'item') {
        if (targetMode === 'bag' && this.mode === 'bag') {
            return this.shiftBags(dCol, dRow);
        } else {
            return this.shiftItems(dCol, dRow);
        }
    }

    /**
     * アイテムがウエストポーチに乗っているマス数をカウント
     * （複数マス乗っていればそのマス数分重複）
     */
    countFannyPackCellsForItem(item) {
        const fannyBags = this.placedBags.filter(b => b.itemId === 'fanny_pack');
        let count = 0;

        for (const [ix, iy] of item.coords) {
            const itemAbsX = item.col + ix;
            const itemAbsY = item.row + iy;

            for (const fanny of fannyBags) {
                for (const [fx, fy] of fanny.coords) {
                    if (fanny.col + fx === itemAbsX && fanny.row + fy === itemAbsY) {
                        count++;
                        break;
                    }
                }
            }
        }
        return count;
    }

    /**
     * sourceItemの★スロットに触れているアイテムを取得（特定タイプでフィルタ可能）
     * ※重要: 1つのアイテムが複数の★に重なっていても1回だけ返す（重複排除）
     */
    getStarredItems(sourceItem, filterType = null) {
        const matched = new Map();

        // sourceItemの各星スロットの絶対座標
        for (const [sx, sy] of sourceItem.starSlots) {
            const starAbsX = sourceItem.col + sx;
            const starAbsY = sourceItem.row + sy;

            // 他のアイテムを探す
            for (const other of this.placedItems) {
                if (other.instanceId === sourceItem.instanceId) continue;
                if (filterType && ITEMS[other.itemId].type !== filterType) continue;

                // otherがstarAbsX, starAbsYを占有しているか
                for (const [ox, oy] of other.coords) {
                    if (other.col + ox === starAbsX && other.row + oy === starAbsY) {
                        matched.set(other.instanceId, other);
                        break;
                    }
                }
            }
        }

        return Array.from(matched.values());
    }

    /**
     * itemがorbItemの★スロットに触れているか判定
     */
    isItemInStarsOf(item, orbItem) {
        for (const [sx, sy] of orbItem.starSlots) {
            const starAbsX = orbItem.col + sx;
            const starAbsY = orbItem.row + sy;

            for (const [ix, iy] of item.coords) {
                if (item.col + ix === starAbsX && item.row + iy === starAbsY) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 指定された食べ物アイテムに隣接している「種類の異なる食べ物アイテム」の配列を取得
     * 隣接判定: 4近傍（上下左右のみ。斜めは含まない）
     * 種類の異なる: other.itemId !== item.itemId
     */
    getAdjacentDifferentFoods(item) {
        if (!item) return [];
        const def = ITEMS[item.itemId];
        if (!def || def.type !== ITEM_TYPES.FOOD) return [];

        const matched = [];
        const itemCells = item.coords.map(([dx, dy]) => [item.col + dx, item.row + dy]);

        for (const other of this.placedItems) {
            if (other.instanceId === item.instanceId) continue;
            const otherDef = ITEMS[other.itemId];
            if (!otherDef || otherDef.type !== ITEM_TYPES.FOOD) continue;

            // 種類が異なること（同種の食べ物は加速対象外）
            if (other.itemId === item.itemId) continue;

            // otherのいずれかのマスが、itemのいずれかのマスと4近傍（上下左右のみ）で隣接しているか判定
            let isAdjacent = false;
            for (const [ox, oy] of other.coords) {
                const otherX = other.col + ox;
                const otherY = other.row + oy;

                for (const [ix, iy] of itemCells) {
                    // 上下左右に隣接（マンハッタン距離が1）
                    if (Math.abs(otherX - ix) + Math.abs(otherY - iy) === 1) {
                        isAdjacent = true;
                        break;
                    }
                }
                if (isAdjacent) break;
            }

            if (isAdjacent) {
                matched.push(other);
            }
        }

        return matched;
    }

    /**
     * グリッド全体の配置データをシリアライズ
     */
    serialize() {
        return {
            mode: this.mode,
            bags: this.placedBags.map(b => ({
                itemId: b.itemId,
                col: b.col,
                row: b.row,
                rotation: b.rotation
            })),
            items: this.placedItems.map(i => ({
                itemId: i.itemId,
                col: i.col,
                row: i.row,
                rotation: i.rotation
            }))
        };
    }

    /**
     * シリアライズデータから盤面を復元
     */
    deserialize(data) {
        this.clear();
        this.mode = data.mode || 'free';

        if (data.bags) {
            for (const b of data.bags) {
                this.placeBag(b.itemId, b.col, b.row, b.rotation);
            }
        }
        if (data.items) {
            for (const i of data.items) {
                this.placeItem(i.itemId, i.col, i.row, i.rotation);
            }
        }
        this.notify();
    }
}

    if (typeof window !== 'undefined') {
        window.GridManager = GridManager;
    }
})();

