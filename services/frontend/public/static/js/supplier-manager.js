/**
 * Supplier Management System
 * Manages suppliers, tracks performance, and handles purchase orders
 */

class SupplierManager {
    constructor() {
        this.suppliers = this.loadSuppliers();
        this.purchaseOrders = this.loadPurchaseOrders();
    }

    loadSuppliers() {
        try {
            const stored = localStorage.getItem('suppliers') || '[]';
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error loading suppliers:', e);
            return [];
        }
    }

    loadPurchaseOrders() {
        try {
            const stored = localStorage.getItem('purchaseOrders') || '[]';
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error loading purchase orders:', e);
            return [];
        }
    }

    saveSupplier(supplierData) {
        try {
            if (!supplierData.id) {
                supplierData.id = 'SUP-' + Date.now();
                supplierData.rating = 0;
                supplierData.totalOrders = 0;
                supplierData.createdAt = new Date().toISOString();
                this.suppliers.push(supplierData);
            } else {
                const index = this.suppliers.findIndex(s => s.id === supplierData.id);
                if (index !== -1) {
                    this.suppliers[index] = { ...this.suppliers[index], ...supplierData };
                }
            }
            localStorage.setItem('suppliers', JSON.stringify(this.suppliers));
            return true;
        } catch (e) {
            console.error('Error saving supplier:', e);
            return false;
        }
    }

    getSupplier(id) {
        return this.suppliers.find(s => s.id === id);
    }

    deleteSupplier(id) {
        try {
            this.suppliers = this.suppliers.filter(s => s.id !== id);
            localStorage.setItem('suppliers', JSON.stringify(this.suppliers));
            return true;
        } catch (e) {
            console.error('Error deleting supplier:', e);
            return false;
        }
    }

    // Crear nueva orden de compra
    createPurchaseOrder(poData) {
        try {
            const po = {
                id: 'PO-' + Date.now(),
                supplierId: poData.supplierId,
                supplierName: poData.supplierName,
                items: poData.items || [],
                totalAmount: poData.totalAmount || 0,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expectedDelivery: poData.expectedDelivery || null,
                notes: poData.notes || ''
            };

            this.purchaseOrders.push(po);
            localStorage.setItem('purchaseOrders', JSON.stringify(this.purchaseOrders));

            // Actualizar contador de pedidos del proveedor
            const supplier = this.getSupplier(poData.supplierId);
            if (supplier) {
                supplier.totalOrders = (supplier.totalOrders || 0) + 1;
                this.saveSupplier(supplier);
            }

            return po;
        } catch (e) {
            console.error('Error creating purchase order:', e);
            return null;
        }
    }

    // Actualizar estado de orden de compra
    updatePurchaseOrderStatus(poId, newStatus) {
        try {
            const index = this.purchaseOrders.findIndex(po => po.id === poId);
            if (index !== -1) {
                this.purchaseOrders[index].status = newStatus;
                this.purchaseOrders[index].updatedAt = new Date().toISOString();
                localStorage.setItem('purchaseOrders', JSON.stringify(this.purchaseOrders));
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error updating purchase order:', e);
            return false;
        }
    }

    // Obtener reporte de proveedor
    getSupplierReport(supplierId) {
        const supplier = this.getSupplier(supplierId);
        if (!supplier) return null;

        const orders = this.purchaseOrders.filter(po => po.supplierId === supplierId);
        const pendingOrders = orders.filter(po => po.status === 'pending').length;
        const completedOrders = orders.filter(po => po.status === 'completed').length;
        const totalSpent = orders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);

        return {
            supplier: supplier,
            totalOrders: orders.length,
            pendingOrders: pendingOrders,
            completedOrders: completedOrders,
            totalSpent: totalSpent,
            rating: supplier.rating || 0,
            performance: {
                onTimeDeliveries: completedOrders,
                lateDeliveries: 0 // Esto se puede calcular con fechas reales
            }
        };
    }

    // Obtener todas las órdenes de compra
    getAllPurchaseOrders() {
        return this.purchaseOrders;
    }

    // Obtener orden de compra por ID
    getPurchaseOrder(poId) {
        return this.purchaseOrders.find(po => po.id === poId);
    }
}

// Export for use in admin panel
window.SupplierManager = SupplierManager;
