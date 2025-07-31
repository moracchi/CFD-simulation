// CFD ポジションシミュレーター
class CFDSimulator {
    constructor() {
        this.rules = [];
        this.profitChart = null;
        this.positionChart = null;
        this.initializeEventListeners();
        this.addInitialRules();
    }

    // Chart.js安全な破棄ラッパー関数（改善2）
    safeDestroy(chart) {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (error) {
                // エラーを無視して続行
                console.warn('Chart destruction warning:', error);
            }
        }
    }

    // イベントリスナーの初期化
    initializeEventListeners() {
        // ルール追加ボタン
        document.getElementById('addRuleBtn').addEventListener('click', () => {
            this.addRule();
        });

        // シミュレーション実行ボタン
        document.getElementById('simulateBtn').addEventListener('click', () => {
            this.runSimulation();
        });

        // タブ切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    // 初期ルールの追加
    addInitialRules() {
        const initialRules = [
            { start: 41150, end: 41950, size: 0.1 },
            { start: 42150, end: 42950, size: 0.2 },
            { start: 43150, end: 43950, size: 0.3 }
        ];

        initialRules.forEach(rule => {
            this.addRule(rule.start, rule.end, rule.size);
        });
    }

    // ルールの追加
    addRule(startPrice = '', endPrice = '', positionSize = '') {
        const container = document.getElementById('rulesContainer');
        const ruleRow = document.createElement('div');
        ruleRow.className = 'rule-row';
        
        // HTML5バリデーション属性付きinput要素（改善1）
        ruleRow.innerHTML = `
            <input type="number" class="rule-start" value="${startPrice}" 
                   placeholder="開始価格" step="1" min="1" required 
                   title="1円以上の整数で入力してください">
            <input type="number" class="rule-end" value="${endPrice}" 
                   placeholder="終了価格" step="1" min="1" required 
                   title="1円以上の整数で入力してください">
            <input type="number" class="rule-size" value="${positionSize}" 
                   placeholder="サイズ" step="0.1" min="0.1" required 
                   title="0.1以上の数値を0.1単位で入力してください">
            <button type="button" class="delete-rule-btn" onclick="this.parentElement.remove()">削除</button>
        `;
        
        container.appendChild(ruleRow);
    }

    // 入力値の検証（HTML5バリデーションで一部簡略化）
    validateInputs() {
        // HTML5バリデーションをチェック
        const form = document.querySelector('.settings-panel');
        const inputs = form.querySelectorAll('input[required], select[required]');
        
        for (let input of inputs) {
            if (!input.checkValidity()) {
                throw new Error(`${input.title || input.placeholder || '入力値'}が無効です`);
            }
        }

        const startPrice = parseFloat(document.getElementById('startPrice').value);
        const addInterval = parseFloat(document.getElementById('addInterval').value);
        const displayInterval = parseFloat(document.getElementById('displayInterval').value);
        
        // ルールのチェック
        const rules = this.getRules();
        if (rules.length === 0) {
            throw new Error('最低1つのポジションサイズルールを設定してください');
        }

        // ルールの妥当性チェック（簡略化）
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule.start >= rule.end) {
                throw new Error(`ルール${i + 1}の開始価格は終了価格より小さくしてください`);
            }
        }

        return { startPrice, addInterval, displayInterval, rules };
    }

    // ルールの取得
    getRules() {
        const rules = [];
        const ruleRows = document.querySelectorAll('.rule-row');
        
        ruleRows.forEach(row => {
            const start = parseFloat(row.querySelector('.rule-start').value);
            const end = parseFloat(row.querySelector('.rule-end').value);
            const size = parseFloat(row.querySelector('.rule-size').value);
            
            if (!isNaN(start) && !isNaN(end) && !isNaN(size)) {
                rules.push({ start, end, size });
            }
        });
        
        return rules;
    }

    // 指定価格でのポジションサイズを取得
    getPositionSizeAtPrice(price, rules) {
        for (const rule of rules) {
            if (price >= rule.start && price <= rule.end) {
                return rule.size;
            }
        }
        return 0;
    }

    // 平均取得単価の計算
    calculateAveragePrice(oldAverage, oldPosition, newPrice, newPosition) {
        if (oldPosition + newPosition === 0) return 0;
        return ((oldAverage * oldPosition) + (newPrice * newPosition)) / (oldPosition + newPosition);
    }

    // 評価損益の計算
    calculateProfitLoss(currentPrice, averagePrice, totalPosition, direction) {
        if (totalPosition === 0) return 0;
        if (direction === 'sell') {
            return (averagePrice - currentPrice) * totalPosition;
        } else {
            return (currentPrice - averagePrice) * totalPosition;
        }
    }

    // シミュレーションの実行
    runSimulation() {
        try {
            // エラーメッセージをクリア
            this.hideError();
            
            // 入力値の検証
            const { startPrice, addInterval, displayInterval, rules } = this.validateInputs();
            const direction = document.getElementById('direction').value;

            // シミュレーション結果の計算
            const results = [];
            let totalPosition = 0;
            let averagePrice = 0;
            
            // 最大価格の決定
            const maxPrice = Math.max(...rules.map(rule => rule.end));
            
            // 価格ごとの計算
            for (let price = startPrice; price <= maxPrice; price += addInterval) {
                price = Math.round(price);
                const positionSize = this.getPositionSizeAtPrice(price, rules);
                
                if (positionSize > 0) {
                    averagePrice = this.calculateAveragePrice(averagePrice, totalPosition, price, positionSize);
                    totalPosition += positionSize;
                    totalPosition = Math.round(totalPosition * 10) / 10;
                }
                
                if ((price - startPrice) % displayInterval === 0 || price === startPrice) {
                    const profitLoss = this.calculateProfitLoss(price, averagePrice, totalPosition, direction);
                    
                    results.push({
                        price: price,
                        totalPosition: totalPosition,
                        averagePrice: averagePrice,
                        profitLoss: profitLoss
                    });
                }
            }

            // 結果の表示
            this.displayResults(results, direction);
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    // 結果の表示
    displayResults(results, direction) {
        document.getElementById('resultsPanel').style.display = 'block';
        this.displaySummary(results[results.length - 1]);
        this.displayTable(results);
        this.displayCharts(results);
        this.switchTab('table');
    }

    // サマリーの表示
    displaySummary(finalResult) {
        const summaryElement = document.getElementById('summary');
        const profitClass = finalResult.profitLoss >= 0 ? '' : 'negative';
        
        summaryElement.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">最終累計ポジション数:</span>
                <span class="summary-value">${finalResult.totalPosition.toFixed(1)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">最終平均取得単価:</span>
                <span class="summary-value">${Math.round(finalResult.averagePrice).toLocaleString('ja-JP')}円</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">最終評価損益:</span>
                <span class="summary-value ${profitClass}">${Math.round(finalResult.profitLoss).toLocaleString('ja-JP')}円</span>
            </div>
        `;
    }

    // テーブルの表示
    displayTable(results) {
        const tableBody = document.querySelector('#resultsTable tbody');
        tableBody.innerHTML = '';
        
        results.forEach(result => {
            const row = document.createElement('tr');
            const profitClass = result.profitLoss >= 0 ? 'profit-positive' : 'profit-negative';
            
            row.innerHTML = `
                <td>${Math.round(result.price).toLocaleString('ja-JP')}円</td>
                <td>${result.totalPosition.toFixed(1)}</td>
                <td>${Math.round(result.averagePrice).toLocaleString('ja-JP')}円</td>
                <td class="${profitClass}">${Math.round(result.profitLoss).toLocaleString('ja-JP')}円</td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    // グラフの表示（安全な破棄を使用）
    displayCharts(results) {
        // 既存のグラフを安全に破棄（改善2）
        this.safeDestroy(this.profitChart);
        this.safeDestroy(this.positionChart);

        const labels = results.map(r => Math.round(r.price).toLocaleString('ja-JP'));
        const profitData = results.map(r => Math.round(r.profitLoss));
        const positionData = results.map(r => Number(r.totalPosition.toFixed(1)));

        // 評価損益グラフ
        const profitCtx = document.getElementById('profitChart').getContext('2d');
        this.profitChart = new Chart(profitCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '評価損益 (円)',
                    data: profitData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: '評価損益の推移'
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString('ja-JP') + '円';
                            }
                        }
                    }
                }
            }
        });

        // ポジション数グラフ
        const positionCtx = document.getElementById('positionChart').getContext('2d');
        this.positionChart = new Chart(positionCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '累計ポジション数',
                    data: positionData,
                    backgroundColor: '#27ae60',
                    borderColor: '#229954',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: '累計ポジション数の推移'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 0.1
                        }
                    }
                }
            }
        });
    }

    // タブの切り替え
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    // エラーメッセージの表示
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    // エラーメッセージの非表示
    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }
}

// ページ読み込み完了時にシミュレーターを初期化
document.addEventListener('DOMContentLoaded', () => {
    new CFDSimulator();
});
