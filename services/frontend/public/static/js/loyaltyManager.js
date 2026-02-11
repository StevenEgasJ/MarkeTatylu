/**
 * Loyalty & Rewards Program Manager
 * Sistema de fidelidad que otorga puntos por compras y permite canjearlos
 */

class LoyaltyManager {
    constructor() {
        // Configuración del programa
        this.config = {
            pointsPerDollar: 0.1,          // 1 punto por cada $10 gastados
            pointsToDiscount: 100,          // 100 puntos = $10 de descuento
            discountValue: 10,              // $10 de descuento por cada 100 puntos
            minPurchaseForPoints: 5,        // Compra mínima para ganar puntos
            welcomeBonus: 50,               // Puntos de bienvenida
            birthdayBonus: 100,             // Puntos de cumpleaños
            referralBonus: 200              // Puntos por referir amigos
        };

        // Niveles de membresía
        this.tiers = {
            bronze: { min: 0, max: 499, name: 'Bronce', multiplier: 1, perks: [] },
            silver: { min: 500, max: 1499, name: 'Plata', multiplier: 1.25, perks: ['Envío gratis en compras >$50'] },
            gold: { min: 1500, max: 2999, name: 'Oro', multiplier: 1.5, perks: ['Envío gratis', 'Descuentos exclusivos'] },
            platinum: { min: 3000, max: Infinity, name: 'Platino', multiplier: 2, perks: ['Envío gratis', 'Descuentos exclusivos', 'Acceso anticipado a ofertas'] }
        };
    }

    // Inicializar programa de lealtad para un usuario
    initializeLoyaltyForUser(userEmail) {
        const key = `loyalty_${userEmail}`;
        let loyalty = this.getLoyaltyData(userEmail);
        
        if (!loyalty) {
            loyalty = {
                email: userEmail,
                points: this.config.welcomeBonus,
                totalPoints: this.config.welcomeBonus,
                tier: 'bronze',
                purchaseCount: 0,
                totalSpent: 0,
                joinDate: new Date().toISOString(),
                lastPurchase: null,
                history: [{
                    date: new Date().toISOString(),
                    type: 'welcome',
                    points: this.config.welcomeBonus,
                    description: 'Bono de bienvenida'
                }]
            };
            localStorage.setItem(key, JSON.stringify(loyalty));
            console.log('✅ Programa de lealtad inicializado para:', userEmail);
        }
        
        return loyalty;
    }

    // Obtener datos de lealtad de un usuario
    getLoyaltyData(userEmail) {
        try {
            const key = `loyalty_${userEmail}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error obteniendo datos de lealtad:', e);
            return null;
        }
    }

    // Guardar datos de lealtad
    saveLoyaltyData(userEmail, loyaltyData) {
        try {
            const key = `loyalty_${userEmail}`;
            localStorage.setItem(key, JSON.stringify(loyaltyData));
            return true;
        } catch (e) {
            console.error('Error guardando datos de lealtad:', e);
            return false;
        }
    }

    // Calcular puntos ganados por una compra
    // Reglas: $0-$10 => 50 pts, $10-$50 => 100 pts, $50+ => 200 pts
    calculatePointsEarned(purchaseAmount) {
        const amount = Number(purchaseAmount) || 0;
        if (amount <= 0) {
            return 0;
        }

        if (amount <= 10) {
            return 50;
        }

        if (amount <= 50) {
            return 100;
        }

        return 200;
    }

    // Agregar puntos por compra
    addPointsForPurchase(userEmail, purchaseAmount, orderId) {
        let loyalty = this.getLoyaltyData(userEmail);
        
        if (!loyalty) {
            loyalty = this.initializeLoyaltyForUser(userEmail);
        }

        const basePoints = this.calculatePointsEarned(purchaseAmount);
        
        if (basePoints === 0) {
            return { success: false, message: 'Compra mínima no alcanzada', points: 0 };
        }

        // Puntos fijos por tramo (sin multiplicador)
        const tier = this.getCurrentTier(loyalty.totalPoints);
        const multiplier = 1;
        const earnedPoints = basePoints;

        // Actualizar datos
        loyalty.points += earnedPoints;
        loyalty.totalPoints += earnedPoints;
        loyalty.purchaseCount += 1;
        loyalty.totalSpent += purchaseAmount;
        loyalty.lastPurchase = new Date().toISOString();
        
        // Agregar al historial
        loyalty.history.push({
            date: new Date().toISOString(),
            type: 'purchase',
            points: earnedPoints,
            amount: purchaseAmount,
            orderId: orderId,
            description: `Compra de $${purchaseAmount.toFixed(2)} (bono de puntos)`
        });

        // Actualizar tier si es necesario
        const newTier = this.getCurrentTier(loyalty.totalPoints);
        if (newTier !== loyalty.tier) {
            const oldTierName = this.tiers[loyalty.tier].name;
            const newTierName = this.tiers[newTier].name;
            loyalty.tier = newTier;
            loyalty.history.push({
                date: new Date().toISOString(),
                type: 'tier_upgrade',
                points: 0,
                description: `¡Ascendido de ${oldTierName} a ${newTierName}!`
            });
        }

        this.saveLoyaltyData(userEmail, loyalty);

        return {
            success: true,
            points: earnedPoints,
            totalPoints: loyalty.points,
            tier: loyalty.tier,
            tierName: this.tiers[loyalty.tier].name,
            multiplier: multiplier
        };
    }

    // Reconciliar puntos usando historial de compras local
    reconcileOrdersFromHistory(userEmail) {
        try {
            if (!userEmail) return { reconciled: 0 };

            const processedOrders = JSON.parse(localStorage.getItem('loyaltyProcessedOrders') || '[]');
            const processedMap = JSON.parse(localStorage.getItem('loyaltyProcessedOrdersMap') || '{}');

            // Prefer user-specific orders list, fallback to comprasHistorial
            const userOrders = JSON.parse(localStorage.getItem(`orders_${userEmail}`) || '[]');
            const globalOrders = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
            const orders = (userOrders && userOrders.length) ? userOrders : globalOrders;

            let reconciled = 0;

            (orders || []).forEach(order => {
                if (!order) return;
                const oid = order.id || order.numeroOrden || order.numeroFactura || '';
                const emailMatch = (order.cliente && order.cliente.email) ? String(order.cliente.email) === String(userEmail) : true;
                if (!emailMatch) return;
                if (oid && processedOrders.includes(oid)) return;

                const totalAmount = order.totales && typeof order.totales.total !== 'undefined' ? Number(order.totales.total) : 0;
                if (!totalAmount || totalAmount <= 0) return;

                const result = this.addPointsForPurchase(userEmail, totalAmount, oid || undefined);
                if (result && result.success && result.points > 0) {
                    reconciled += 1;
                    if (oid) {
                        processedOrders.push(oid);
                        processedMap[oid] = result.points;
                    }
                }
            });

            localStorage.setItem('loyaltyProcessedOrders', JSON.stringify(processedOrders));
            localStorage.setItem('loyaltyProcessedOrdersMap', JSON.stringify(processedMap));

            return { reconciled };
        } catch (e) {
            console.warn('reconcileOrdersFromHistory failed', e);
            return { reconciled: 0 };
        }
    }

    // Determinar el nivel actual basado en puntos totales
    getCurrentTier(totalPoints) {
        for (const [key, tier] of Object.entries(this.tiers)) {
            if (totalPoints >= tier.min && totalPoints <= tier.max) {
                return key;
            }
        }
        return 'bronze';
    }

    // Canjear puntos por descuento
    redeemPoints(userEmail, pointsToRedeem) {
        let loyalty = this.getLoyaltyData(userEmail);
        
        if (!loyalty) {
            return { success: false, message: 'Usuario no encontrado' };
        }

        if (pointsToRedeem > loyalty.points) {
            return { success: false, message: 'Puntos insuficientes' };
        }

        if (pointsToRedeem < this.config.pointsToDiscount) {
            return { 
                success: false, 
                message: `Mínimo ${this.config.pointsToDiscount} puntos para canjear` 
            };
        }

        // Calcular descuento
        const discount = (pointsToRedeem / this.config.pointsToDiscount) * this.config.discountValue;
        
        // Descontar puntos
        loyalty.points -= pointsToRedeem;
        
        // Agregar al historial
        loyalty.history.push({
            date: new Date().toISOString(),
            type: 'redemption',
            points: -pointsToRedeem,
            discount: discount,
            description: `Canjeados ${pointsToRedeem} puntos por $${discount.toFixed(2)} de descuento`
        });

        this.saveLoyaltyData(userEmail, loyalty);

        return {
            success: true,
            discount: discount,
            pointsRedeemed: pointsToRedeem,
            remainingPoints: loyalty.points
        };
    }

    // Obtener resumen del programa de lealtad
    getLoyaltySummary(userEmail) {
        const loyalty = this.getLoyaltyData(userEmail) || this.initializeLoyaltyForUser(userEmail);
        const tier = this.tiers[loyalty.tier];
        const nextTier = this.getNextTier(loyalty.tier);

        return {
            points: loyalty.points,
            totalPoints: loyalty.totalPoints,
            tier: loyalty.tier,
            tierName: tier.name,
            multiplier: tier.multiplier,
            perks: tier.perks,
            nextTier: nextTier ? {
                name: nextTier.name,
                pointsNeeded: nextTier.min - loyalty.totalPoints
            } : null,
            purchaseCount: loyalty.purchaseCount,
            totalSpent: loyalty.totalSpent,
            availableDiscount: Math.floor(loyalty.points / this.config.pointsToDiscount) * this.config.discountValue,
            history: loyalty.history.slice(-10).reverse() // Últimas 10 transacciones
        };
    }

    // Obtener el siguiente nivel
    getNextTier(currentTier) {
        const tiers = ['bronze', 'silver', 'gold', 'platinum'];
        const currentIndex = tiers.indexOf(currentTier);
        
        if (currentIndex < tiers.length - 1) {
            const nextTierKey = tiers[currentIndex + 1];
            return this.tiers[nextTierKey];
        }
        
        return null;
    }

    // Agregar puntos de cumpleaños
    addBirthdayBonus(userEmail) {
        let loyalty = this.getLoyaltyData(userEmail);
        
        if (!loyalty) {
            loyalty = this.initializeLoyaltyForUser(userEmail);
        }

        loyalty.points += this.config.birthdayBonus;
        loyalty.totalPoints += this.config.birthdayBonus;
        
        loyalty.history.push({
            date: new Date().toISOString(),
            type: 'birthday',
            points: this.config.birthdayBonus,
            description: '¡Feliz cumpleaños! Bono especial'
        });

        this.saveLoyaltyData(userEmail, loyalty);

        return {
            success: true,
            bonusPoints: this.config.birthdayBonus,
            totalPoints: loyalty.points
        };
    }

    // Agregar puntos por referir amigos
    addReferralBonus(userEmail) {
        let loyalty = this.getLoyaltyData(userEmail);
        
        if (!loyalty) {
            loyalty = this.initializeLoyaltyForUser(userEmail);
        }

        loyalty.points += this.config.referralBonus;
        loyalty.totalPoints += this.config.referralBonus;
        
        loyalty.history.push({
            date: new Date().toISOString(),
            type: 'referral',
            points: this.config.referralBonus,
            description: 'Bono por referir un amigo'
        });

        this.saveLoyaltyData(userEmail, loyalty);

        return {
            success: true,
            bonusPoints: this.config.referralBonus,
            totalPoints: loyalty.points
        };
    }
}

// Exportar instancia global
window.loyaltyManager = new LoyaltyManager();
