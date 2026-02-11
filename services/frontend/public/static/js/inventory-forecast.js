/**
 * Inventory Forecasting System
 * Predicts future stock needs based on historical sales data
 */

class InventoryForecast {
    constructor() {
        this.products = this.loadProducts();
        this.salesHistory = this.loadSalesHistory();
    }

    loadProducts() {
        try {
            // Try to get from admin manager first (in-memory, server data)
            if (typeof adminManager !== 'undefined' && adminManager && typeof adminManager.getProducts === 'function') {
                const products = adminManager.getProducts();
                console.log('InventoryForecast: Loaded products from adminManager:', products.length);
                return products;
            }
            
            // Fallback to localStorage
            const stored = localStorage.getItem('productos') || '[]';
            const products = JSON.parse(stored);
            console.log('InventoryForecast: Loaded products from localStorage:', products.length);
            return products;
        } catch (e) {
            console.error('Error loading products:', e);
            return [];
        }
    }

    loadSalesHistory() {
        try {
            // Try orders from admin manager first
            if (typeof adminManager !== 'undefined' && adminManager && typeof adminManager.getOrders === 'function') {
                const orders = adminManager.getOrders();
                console.log('InventoryForecast: Loaded orders from adminManager:', orders.length);
                return orders;
            }
            
            // Fallback to localStorage
            const stored = localStorage.getItem('pedidos') || '[]';
            const orders = JSON.parse(stored);
            console.log('InventoryForecast: Loaded orders from localStorage:', orders.length);
            return orders;
        } catch (e) {
            console.error('Error loading sales history:', e);
            return [];
        }
    }

    // Get products that need reordering
    getProductsNeedingReorder() {
        const needReorder = [];
        const LOW_STOCK_THRESHOLD = 10; // Umbral de stock bajo

        this.products.forEach(product => {
            // Asegurarse de que el stock es un número válido
            const currentStock = Number(product.stock) || 0;
            const reorderPoint = this.calculateReorderPoint(product.id);
            
            // Incluir productos con stock bajo O que estén por debajo del punto de reorden
            const needsReorder = currentStock <= reorderPoint || currentStock < LOW_STOCK_THRESHOLD;
            
            if (needsReorder) {
                const prediction = this.predictStockoutDate(product.id, currentStock);
                const optimalQty = this.calculateOptimalOrderQuantity(product.id);
                
                // Si no hay cantidad óptima calculada (sin historial de ventas), 
                // sugerir una cantidad basada en el umbral de stock bajo
                const recommendedQty = optimalQty > 0 ? optimalQty : Math.max(20, LOW_STOCK_THRESHOLD * 2);
                
                needReorder.push({
                    product: product,
                    currentStock: currentStock,
                    reorderPoint: Math.max(reorderPoint, LOW_STOCK_THRESHOLD),
                    prediction: prediction,
                    recommendedOrderQty: recommendedQty,
                    urgency: this.calculateUrgency(currentStock, Math.max(reorderPoint, LOW_STOCK_THRESHOLD), prediction),
                    reason: currentStock < LOW_STOCK_THRESHOLD ? 'low-stock' : 'reorder-point'
                });
            }
        });

        return needReorder.sort((a, b) => b.urgency - a.urgency);
    }

    calculateReorderPoint(productId) {
        const avgDailySales = this.calculateAverageDailySales(productId);
        const leadTime = 7; // días
        const safetyStock = Math.ceil(avgDailySales * 2);
        return Math.ceil((avgDailySales * leadTime) + safetyStock);
    }

    calculateAverageDailySales(productId, days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        let totalSold = 0;
        
        this.salesHistory.forEach(order => {
            const orderDate = new Date(order.fecha || order.createdAt || Date.now());
            if (orderDate >= cutoffDate) {
                const items = order.productos || order.items || [];
                items.forEach(item => {
                    const itemId = String(item.id || item.productId || item._id || '').trim();
                    const prodId = String(productId).trim();
                    if (itemId === prodId) {
                        const qty = Number(item.cantidad || item.qty || item.quantity || 0);
                        totalSold += qty;
                    }
                });
            }
        });
        
        return totalSold / days;
    }

    calculateOptimalOrderQuantity(productId) {
        const avgDailySales = this.calculateAverageDailySales(productId);
        const orderFrequency = 14; // días entre pedidos
        return Math.ceil(avgDailySales * orderFrequency * 1.5); // 50% buffer
    }

    predictStockoutDate(productId, currentStock) {
        const avgDailySales = this.calculateAverageDailySales(productId);
        
        if (avgDailySales === 0) {
            return null;
        }
        
        const daysRemaining = Math.floor(currentStock / avgDailySales);
        const stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + daysRemaining);
        
        return {
            daysRemaining: daysRemaining,
            date: stockoutDate,
            avgDailySales: avgDailySales
        };
    }

    calculateUrgency(currentStock, reorderPoint, prediction) {
        if (currentStock === 0) return 100;
        if (!prediction || prediction.daysRemaining === 0) return 90;
        
        const stockRatio = currentStock / reorderPoint;
        const timeUrgency = Math.max(0, 100 - (prediction.daysRemaining * 5));
        
        return Math.min(100, Math.round((1 - stockRatio) * 50 + timeUrgency * 0.5));
    }

    calculateTrend(productId, recentDays = 7, olderDays = 30) {
        const recentAvg = this.calculateAverageDailySales(productId, recentDays);
        const olderAvg = this.calculateAverageDailySales(productId, olderDays);
        
        if (olderAvg === 0) return 'stable';
        
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        if (change > 20) return 'increasing';
        if (change < -20) return 'decreasing';
        return 'stable';
    }

    // Generate forecast report
    generateForecastReport() {
        const report = {
            date: new Date().toISOString(),
            totalProducts: this.products.length,
            productsNeedingReorder: [],
            lowStockWarnings: [],
            outOfStockProducts: [],
            salesTrends: {}
        };

        const LOW_STOCK_THRESHOLD = 10;
        const CRITICAL_STOCK_THRESHOLD = 5;

        this.products.forEach(product => {
            const currentStock = Number(product.stock) || 0;
            const reorderPoint = this.calculateReorderPoint(product.id);
            const avgDailySales = this.calculateAverageDailySales(product.id);
            
            // Out of stock
            if (currentStock === 0) {
                report.outOfStockProducts.push({
                    id: product.id,
                    nombre: product.nombre,
                    avgDailySales: avgDailySales.toFixed(2)
                });
            }
            // Critical low stock warning (menos de 5 unidades)
            else if (currentStock <= CRITICAL_STOCK_THRESHOLD) {
                report.lowStockWarnings.push({
                    id: product.id,
                    nombre: product.nombre,
                    currentStock: currentStock,
                    reorderPoint: Math.max(reorderPoint, LOW_STOCK_THRESHOLD),
                    severity: 'critical'
                });
            }
            // Low stock warning (menos de 10 unidades)
            else if (currentStock < LOW_STOCK_THRESHOLD) {
                report.lowStockWarnings.push({
                    id: product.id,
                    nombre: product.nombre,
                    currentStock: currentStock,
                    reorderPoint: Math.max(reorderPoint, LOW_STOCK_THRESHOLD),
                    severity: 'warning'
                });
            }
            // Needs reorder based on sales velocity
            else if (currentStock <= reorderPoint) {
                report.productsNeedingReorder.push({
                    id: product.id,
                    nombre: product.nombre,
                    currentStock: currentStock,
                    reorderPoint: reorderPoint,
                    recommendedQty: this.calculateOptimalOrderQuantity(product.id)
                });
            }

            // Sales trends
            report.salesTrends[product.id] = {
                avgDaily7Days: this.calculateAverageDailySales(product.id, 7),
                avgDaily30Days: this.calculateAverageDailySales(product.id, 30),
                trend: this.calculateTrend(product.id)
            };
        });

        return report;
    }

    exportToCSV() {
        const report = this.generateForecastReport();
        let csv = 'ID,Nombre,Stock Actual,Punto de Reorden,Estado,Urgencia,Recomendación\n';
        
        this.getProductsNeedingReorder().forEach(item => {
            csv += `"${item.product.id}","${item.product.nombre}",${item.currentStock},${item.reorderPoint},"${item.reason}",${item.urgency},"Ordenar ${item.recommendedOrderQty} unidades"\n`;
        });
        
        return csv;
    }
}

// Export for use in admin panel
window.InventoryForecast = InventoryForecast;
