const db = require('../config/db');
const { validationResult } = require('express-validator');

const carritoController = {
    // OBTENER el carrito del usuario actual
    getCarrito: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;

            const [items] = await db.query(`
                SELECT 
                    c.id as carrito_id,
                    c.cantidad,
                    c.fecha_agregado,
                    p.id as producto_id,
                    p.nombre,
                    p.descripcion,
                    p.precio,
                    p.stock,
                    p.imagen_url,
                    (p.precio * c.cantidad) as subtotal
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.usuario_id = ?
                ORDER BY c.fecha_agregado DESC
            `, [usuarioId]);

            // Calcular total del carrito
            const total = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

            res.json({
                success: true,
                data: {
                    items,
                    total: total.toFixed(2),
                    cantidad_items: items.length
                }
            });

        } catch (error) {
            console.error('Error al obtener carrito:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // AÑADIR producto al carrito
    agregarProducto: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const usuarioId = req.usuario.id;
            const { producto_id, cantidad } = req.body;

            // Verificar que el producto existe y tiene stock
            const [productos] = await db.query(
                'SELECT id, nombre, precio, stock FROM productos WHERE id = ?',
                [producto_id]
            );

            if (productos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            const producto = productos[0];

            if (producto.stock < cantidad) {
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente. Solo hay ${producto.stock} unidades disponibles`
                });
            }

            // Verificar si el producto ya está en el carrito
            const [existe] = await db.query(
                'SELECT id, cantidad FROM carrito WHERE usuario_id = ? AND producto_id = ?',
                [usuarioId, producto_id]
            );

            let result;
            if (existe.length > 0) {
                // Actualizar cantidad si ya existe
                const nuevaCantidad = existe[0].cantidad + cantidad;
                
                // Verificar stock para la nueva cantidad
                if (producto.stock < nuevaCantidad) {
                    return res.status(400).json({
                        success: false,
                        message: `No puedes agregar más. Stock máximo disponible: ${producto.stock}`
                    });
                }

                await db.query(
                    'UPDATE carrito SET cantidad = ? WHERE id = ?',
                    [nuevaCantidad, existe[0].id]
                );
                
                result = { insertId: existe[0].id };
            } else {
                // Insertar nuevo item
                [result] = await db.query(
                    'INSERT INTO carrito (usuario_id, producto_id, cantidad) VALUES (?, ?, ?)',
                    [usuarioId, producto_id, cantidad]
                );
            }

            // Obtener el item actualizado
            const [itemActualizado] = await db.query(`
                SELECT 
                    c.id as carrito_id,
                    c.cantidad,
                    p.id as producto_id,
                    p.nombre,
                    p.precio,
                    p.imagen_url,
                    (p.precio * c.cantidad) as subtotal
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.id = ?
            `, [result.insertId || result.id]);

            res.status(201).json({
                success: true,
                message: 'Producto agregado al carrito',
                data: itemActualizado[0]
            });

        } catch (error) {
            console.error('Error al agregar al carrito:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // ACTUALIZAR cantidad de un producto en el carrito
    actualizarCantidad: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const usuarioId = req.usuario.id;
            const { itemId } = req.params;
            const { cantidad } = req.body;

            // Verificar que el item pertenece al usuario
            const [items] = await db.query(`
                SELECT c.*, p.stock as stock_producto, p.nombre
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.id = ? AND c.usuario_id = ?
            `, [itemId, usuarioId]);

            if (items.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Item no encontrado en tu carrito'
                });
            }

            const item = items[0];

            // Verificar stock
            if (item.stock_producto < cantidad) {
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente. Solo hay ${item.stock_producto} unidades disponibles`
                });
            }

            // Actualizar cantidad
            await db.query(
                'UPDATE carrito SET cantidad = ? WHERE id = ?',
                [cantidad, itemId]
            );

            // Obtener item actualizado
            const [itemActualizado] = await db.query(`
                SELECT 
                    c.id as carrito_id,
                    c.cantidad,
                    p.id as producto_id,
                    p.nombre,
                    p.precio,
                    p.imagen_url,
                    (p.precio * c.cantidad) as subtotal
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.id = ?
            `, [itemId]);

            res.json({
                success: true,
                message: 'Cantidad actualizada',
                data: itemActualizado[0]
            });

        } catch (error) {
            console.error('Error al actualizar cantidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // ELIMINAR producto del carrito
    eliminarProducto: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;
            const { itemId } = req.params;

            // Verificar que el item pertenece al usuario
            const [items] = await db.query(
                'SELECT id FROM carrito WHERE id = ? AND usuario_id = ?',
                [itemId, usuarioId]
            );

            if (items.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Item no encontrado en tu carrito'
                });
            }

            // Eliminar item
            await db.query('DELETE FROM carrito WHERE id = ?', [itemId]);

            res.json({
                success: true,
                message: 'Producto eliminado del carrito'
            });

        } catch (error) {
            console.error('Error al eliminar del carrito:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // VACIAR todo el carrito
    vaciarCarrito: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;

            await db.query('DELETE FROM carrito WHERE usuario_id = ?', [usuarioId]);

            res.json({
                success: true,
                message: 'Carrito vaciado exitosamente'
            });

        } catch (error) {
            console.error('Error al vaciar carrito:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // VERIFICAR stock antes de proceder al pago
    verificarStock: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;

            const [items] = await db.query(`
                SELECT 
                    c.producto_id,
                    c.cantidad,
                    p.nombre,
                    p.stock as stock_disponible,
                    CASE 
                        WHEN p.stock >= c.cantidad THEN 'disponible'
                        ELSE 'insuficiente'
                    END as estado
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.usuario_id = ?
            `, [usuarioId]);

            const itemsSinStock = items.filter(item => item.estado === 'insuficiente');
            const stockDisponible = itemsSinStock.length === 0;

            res.json({
                success: true,
                data: {
                    stockDisponible,
                    items,
                    itemsSinStock,
                    mensaje: stockDisponible 
                        ? 'Stock verificado, puedes proceder al pago'
                        : 'Algunos productos no tienen stock suficiente'
                }
            });

        } catch (error) {
            console.error('Error al verificar stock:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    }
};

module.exports = carritoController;