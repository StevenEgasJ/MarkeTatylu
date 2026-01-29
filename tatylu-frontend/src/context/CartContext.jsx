import { createContext, useContext, useState, useEffect } from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';
import Swal from 'sweetalert2';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState(null);
  const { isAuthenticated, user } = useAuth();

  // Cargar carrito desde localStorage o servidor
  useEffect(() => {
    loadCart();
  }, [isAuthenticated]);

  const loadCart = async () => {
    try {
      // Siempre cargar desde localStorage primero
      const savedCart = localStorage.getItem('carrito');
      if (savedCart) {
        setItems(JSON.parse(savedCart));
      }

      // Si está autenticado, sincronizar con servidor
      if (isAuthenticated) {
        try {
          const response = await cartAPI.get();
          if (response.data?.items?.length > 0) {
            setItems(response.data.items);
            localStorage.setItem('carrito', JSON.stringify(response.data.items));
          }
        } catch (error) {
          console.log('Error cargando carrito del servidor:', error);
        }
      }
    } catch (error) {
      console.error('Error cargando carrito:', error);
    }
  };

  const saveCart = (cartItems) => {
    localStorage.setItem('carrito', JSON.stringify(cartItems));
    setItems(cartItems);
  };

  const addToCart = async (product, quantity = 1) => {
    try {
      // Verificar stock
      if (product.stock !== undefined && product.stock < quantity) {
        await Swal.fire({
          icon: 'warning',
          title: 'Stock insuficiente',
          text: `Solo hay ${product.stock} unidades disponibles`
        });
        return false;
      }

      const existingIndex = items.findIndex(item => 
        item.productId === product._id || item._id === product._id || item.id === product._id
      );

      let newItems;
      if (existingIndex >= 0) {
        // Actualizar cantidad
        newItems = items.map((item, index) => {
          if (index === existingIndex) {
            const newQty = item.quantity + quantity;
            if (product.stock !== undefined && newQty > product.stock) {
              Swal.fire({
                icon: 'warning',
                title: 'Stock insuficiente',
                text: `No puedes agregar más de ${product.stock} unidades`
              });
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        });
      } else {
        // Agregar nuevo item
        const cartItem = {
          productId: product._id || product.id,
          _id: product._id || product.id,
          nombre: product.nombre || product.name,
          precio: product.precio || product.price,
          imagen: product.imagen || product.image,
          quantity: quantity,
          stock: product.stock
        };
        newItems = [...items, cartItem];
      }

      saveCart(newItems);

      // Sincronizar con servidor si está autenticado
      if (isAuthenticated) {
        try {
          await cartAPI.add(product._id || product.id, quantity);
        } catch (error) {
          console.log('Error sincronizando carrito:', error);
        }
      }

      // Toast de confirmación
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
      Toast.fire({
        icon: 'success',
        title: 'Producto agregado al carrito'
      });

      return true;
    } catch (error) {
      console.error('Error agregando al carrito:', error);
      return false;
    }
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity < 1) {
      return removeFromCart(productId);
    }

    const item = items.find(i => i.productId === productId || i._id === productId);
    if (item?.stock !== undefined && quantity > item.stock) {
      await Swal.fire({
        icon: 'warning',
        title: 'Stock insuficiente',
        text: `Solo hay ${item.stock} unidades disponibles`
      });
      return;
    }

    const newItems = items.map(item => {
      if (item.productId === productId || item._id === productId) {
        return { ...item, quantity };
      }
      return item;
    });

    saveCart(newItems);

    if (isAuthenticated) {
      try {
        await cartAPI.update(productId, quantity);
      } catch (error) {
        console.log('Error actualizando carrito:', error);
      }
    }
  };

  const removeFromCart = async (productId) => {
    const newItems = items.filter(item => 
      item.productId !== productId && item._id !== productId
    );
    
    saveCart(newItems);

    if (isAuthenticated) {
      try {
        await cartAPI.remove(productId);
      } catch (error) {
        console.log('Error eliminando del carrito:', error);
      }
    }

    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
    Toast.fire({
      icon: 'info',
      title: 'Producto eliminado'
    });
  };

  const clearCart = async () => {
    setItems([]);
    localStorage.removeItem('carrito');
    setCoupon(null);

    if (isAuthenticated && user) {
      try {
        const userId = user._id || user.id;
        if (userId) {
          await cartAPI.clear(userId);
        }
      } catch (error) {
        console.log('Error limpiando carrito:', error);
      }
    }
  };

  const applyCoupon = async (code) => {
    try {
      const response = await cartAPI.applyCoupon(code);
      setCoupon(response.data.coupon);
      
      await Swal.fire({
        icon: 'success',
        title: '¡Cupón aplicado!',
        text: `Descuento: ${response.data.coupon.discount}%`,
        timer: 2000
      });

      return { success: true, coupon: response.data.coupon };
    } catch (error) {
      const message = error.response?.data?.message || 'Cupón inválido';
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message
      });
      return { success: false, error: message };
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
  };

  // Calcular totales
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.precio || item.price || 0) * item.quantity;
  }, 0);

  const discount = coupon ? (subtotal * coupon.discount / 100) : 0;
  const total = subtotal - discount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const value = {
    items,
    loading,
    coupon,
    subtotal,
    discount,
    total,
    itemCount,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    loadCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
