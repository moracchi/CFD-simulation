// CFDポジションシミュレーター本体クラス
class CFDSimulator {
    constructor() {
        this.rules = [];
        this.initializeEventListeners();
        this.addInitialRules();
    }

    initializeEventListeners() {
        document.getElementById('addRuleBtn').addEventListener('click', () => {
            this.addRule();
        });
        document.getElementById('simulateBtn').addEventListener('click', () => {
            this.runSimulation();
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    addInitialRules() {
        // デフォルトルール
        const initialRules = [
            { start: 41150, end: 41950, size: 0.1 },
            { start: 42150, end: 42950, size: 0.2 },
            { start: 43150, end: 43950, size: 0.3 }
        ];
        initialRules.forEach(rule => {
            this.addRule(rule.start, rule.end, rule.size);
        });
    }

    addRule(startPrice = '', endPrice = '', positionSize = '') {
        const container = document.getElementById('rulesContainer');
        const ruleRow = document.createElement('div');
        ruleRow.className = 'rule-row';
        ruleRow.innerHTML = `
            <input type="number" class="rule-start" value="${startPrice}" placeholder="開始価格" step="1">
            <input type="number" class="rule-end" value="${endPrice}" placeholder="終了価格" step="1">
            <input type="number" class="rule-size" value="${positionSize}" placeholder="サイズ" step="0.1">
            <button type="button" class="delete-rule-btn" onclick="this.parentElement.remove()">削除</button>
        `;
        container.appendChild(ruleRow);
    }

    validateInputs() {
        const startPrice = parseFloat(document.getElementById('startPrice').value);
        const addInterval = parseFloat(document.getElementById('addInterval').value);
        const displayInterval = parseFloat(document.getElementById('displayInterval').value);
        if (isNaN(startPrice) || startPrice <= 0) throw new Error('開始価格は正の数値を入力してください');
        if (isNaN(addInterval) || addInterval <= 0) throw new Error('ポジション追加の価格幅は正の数値を入力してください');
        if (isNaN(displayInterval) || displayInterval <= 0) throw new Error('表示する価格間隔は正の数値を入力してください');
        const rules = this.getRules();
        if (rules.length === 0) throw new Error('最低1つのポジションサイズルールを設定してください');
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (isNaN(rule.start) || isNaN(rule.end) || isNaN(rule.size)) throw new Error(`ルール${i + 1}に無効な値があります`);
            if (rule.start >= rule.end) throw new Error(`ルール${i + 1}の開始価格は終了価格より小さくしてください`);
            if (rule.size <= 0) throw new Error(`ルール${i + 1}のポジションサイズは正の数値を入力してください`);
            if (Math.round(rule.size * 10) % 1 !== 0) throw new Error(`ルール${i + 1}のサイズは0.1単位にしてください`);
        }
        return { startPrice, addInterval, displayInterval, rules };
    }

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

    getPositionSizeAtPrice(price, rules) {
        for (const rule of rules) {
            if (price >= rule.start && price <= rule.end) {
                return rule.size;
            }
        }
        return 0;
    }

    calculateAveragePrice(oldAverage, oldPosition, newPrice, newPosition) {
        if (oldPosition + newPosition === 0) return 0;
        return ((oldAverage * oldPosition) + (newPrice * newPosition)) / (oldPosition + newPosition);
    }

    // 評価損益の計算式を明確化
    // 売り:(平均取得単価 - 現在価格) x 累計ポジション数
    // 買い:(現在価格 - 平均取得単価) x 累計ポジション数
    calculateProfitLoss(currentPrice, averagePrice, totalPosition, direction) {
        if (totalPosition === 0) return 0;
        if (direction === 'sell') {
            return (averagePrice - currentPrice) * totalPosition;
        } else {
            return (currentPrice - averagePrice) * totalPosition;
        }
    }

    runSimulation() {
        try {
            this.hideError();
            const { startPrice, addInterval, displayInterval, rules } = this.validateInputs();
            const direction = document.getElementById('direction').value;
            const results = [];
            let totalPosition = 0;
            let averagePrice = 0;
            const maxPrice = Math.max(...rules.map(rule => rule.end));
            for (let price = startPrice; price <= maxPrice; price += addInterval) {
                // 小数切り捨て＆整数で計算
                price = Math.round(price);
                const positionSize = this.getPositionSizeAtPrice(price, rules);
                if (positionSize > 0) {
                    // 0.1単位管理
                    averagePrice = this.calculateAveragePrice(averagePrice, totalPosition, price, positionSize);
                    totalPosition += positionSize;
                    // 0.1単位で丸める
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
            this.displayResults(results, direction);
        } catch (error) {
            this.showError(error.message);
        }
    }

    displayResults(results, direction) {
        document.getElementById('resultsPanel').style.display = 'block';
        this.displaySummary(results[results.length - 1]);
        this.displayTable(results);
        this.displayCharts(results);
        this.switchTab('table');
    }

    // 累計ポジション0.1単位、小数1位だけ表示するよう修正
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

    displayTable(results) {
        const tableBody = document.querySelector('#resultsTable tbody');
        tableBody.innerHTML = '';
        results.forEach(result => {
            const profitClass = result.profitLoss >= 0 ? 'profit-positive' : 'profit-negative';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${Math.round(result.price).toLocaleString('ja-JP')}円</td>
                <td>${result.totalPosition.toFixed(1)}</td>
                <td>${Math.round(result.averagePrice).toLocaleString('ja-JP')}円</td>
                <td class="${profitClass}">${Math.round(result.profitLoss).toLocaleString('ja-JP')}円</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    displayCharts(results) {
        if (this.profitChart) this.profitChart.destroy();
        if (this.positionChart) this.positionChart.destroy();
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
                    backgroundColor: 'rgba(52,152,219,0.1)',
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

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }
    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    new CFDSimulator();
});
