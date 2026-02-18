// ========== FUNCIONES COMPARTIDAS DEL CARRITO ==========

// Estado del carrito
let carrito = { items: [], total: 0 };

// Cargar carrito desde el backend
async function cargarCarrito() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('/api/carrito', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            carrito = data.data;
            actualizarCarritoUI();
        }
    } catch (error) {
        console.error('Error al cargar carrito:', error);
    }
}

// Agregar producto al carrito
async function agregarAlCarrito(productoId) {
    const token = localStorage.getItem('token');
    
    if (!token) {
        if (typeof mostrarLogin === 'function') {
            mostrarLogin();
        } else {
            window.location.href = '/';
        }
        return;
    }

    try {
        const res = await fetch('/api/carrito/agregar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ producto_id: productoId, cantidad: 1 })
        });

        const data = await res.json();
        
        if (data.success) {
            await cargarCarrito();
            mostrarNotificacion('✨ Producto agregado al carrito', 'success');
        } else {
            mostrarNotificacion(data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al agregar al carrito', 'error');
    }
}

// Actualizar cantidad
async function actualizarCantidad(itemId, nuevaCantidad) {
    const token = localStorage.getItem('token');
    
    if (nuevaCantidad < 1) {
        eliminarDelCarrito(itemId);
        return;
    }

    try {
        const res = await fetch(`/api/carrito/item/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ cantidad: nuevaCantidad })
        });

        const data = await res.json();
        
        if (data.success) {
            await cargarCarrito();
        } else {
            mostrarNotificacion(data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al actualizar cantidad', 'error');
    }
}

// Eliminar del carrito
async function eliminarDelCarrito(itemId) {
    const token = localStorage.getItem('token');
    
    if (!confirm('¿Eliminar este producto del carrito?')) return;

    try {
        const res = await fetch(`/api/carrito/item/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        
        if (data.success) {
            await cargarCarrito();
            mostrarNotificacion('Producto eliminado', 'info');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al eliminar', 'error');
    }
}

// Vaciar carrito
async function vaciarCarrito() {
    const token = localStorage.getItem('token');
    
    if (!confirm('¿Vaciar todo el carrito?')) return;

    try {
        const res = await fetch('/api/carrito', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        
        if (data.success) {
            await cargarCarrito();
            mostrarNotificacion('Carrito vaciado', 'info');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al vaciar carrito', 'error');
    }
}

// Actualizar UI del carrito
function actualizarCarritoUI() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!cartItems || !cartCount || !cartTotal) return;

    if (!carrito.items || carrito.items.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #718096; padding: 2rem;">🛒 Tu carrito está vacío</p>';
        cartCount.textContent = '0';
        cartTotal.textContent = '$0.00';
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    cartItems.innerHTML = '';
    carrito.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <img src="${item.imagen_url || 'https://via.placeholder.com/80'}" alt="${item.nombre}" onerror="this.src='https://via.placeholder.com/80'">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.nombre}</div>
                <div class="cart-item-price">$${parseFloat(item.precio).toFixed(2)} c/u</div>
                <div class="cart-item-actions">
                    <button onclick="actualizarCantidad(${item.carrito_id}, ${item.cantidad - 1})">−</button>
                    <span>${item.cantidad}</span>
                    <button onclick="actualizarCantidad(${item.carrito_id}, ${item.cantidad + 1})">+</button>
                    <span class="remove-item" onclick="eliminarDelCarrito(${item.carrito_id})">🗑️</span>
                </div>
                <div style="margin-top: 0.5rem; color: #667eea; font-weight: bold;">Subtotal: $${parseFloat(item.subtotal).toFixed(2)}</div>
            </div>
        `;
        cartItems.appendChild(itemElement);
    });

    cartCount.textContent = carrito.items.reduce((sum, item) => sum + item.cantidad, 0);
    cartTotal.textContent = `$${parseFloat(carrito.total).toFixed(2)}`;
    
    if (checkoutBtn) {
        verificarStockPago();
    }
}

// Verificar stock antes del pago
async function verificarStockPago() {
    const token = localStorage.getItem('token');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (!token || !checkoutBtn) return;

    try {
        const res = await fetch('/api/carrito/verificar-stock', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success && data.data.stockDisponible) {
            checkoutBtn.disabled = false;
        } else {
            checkoutBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Toggle carrito sidebar
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// Notificaciones
function mostrarNotificacion(mensaje, tipo = 'success') {
    // Verificar si ya existe un contenedor de notificaciones
    let container = document.getElementById('notificationContainer');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensaje;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Exportar funciones para usar en otras páginas
window.carritoFunctions = {
    cargarCarrito,
    agregarAlCarrito,
    actualizarCantidad,
    eliminarDelCarrito,
    vaciarCarrito,
    toggleCart,
    mostrarNotificacion
};