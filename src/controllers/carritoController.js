// src/controllers/carritoController.js
const db = require('../config/db');

const carritoController = {
    // ✅ OBTENER CARRITO DEL USUARIO
    obtener: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;

            const [items] = await db.query(
                `SELECT 
                    c.id as carrito_id,
                    c.cantidad,
                    p.id as producto_id,
                    p.nombre,
                    p.precio,
                    p.stock,
                    p.imagen_url,
                    (p.precio * c.cantidad) as subtotal
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.usuario_id = ?`,
                [usuarioId]
            );

            const total = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

            res.json({
                success: true,
                data: {
                    items,
                    total
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener carrito:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener carrito'
            });
        }
    },

    // ✅ AGREGAR PRODUCTO AL CARRITO
    agregar: async (req, res) => {
        try {
            const { producto_id, cantidad = 1 } = req.body;
            const usuarioId = req.usuario.id;

            // Verificar que el producto existe y tiene stock
            const [productos] = await db.query(
                'SELECT id, stock FROM productos WHERE id = ?',
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
                    message: 'Stock insuficiente'
                });
            }

            // Verificar si el producto ya está en el carrito
            const [existentes] = await db.query(
                'SELECT id, cantidad FROM carrito WHERE usuario_id = ? AND producto_id = ?',
                [usuarioId, producto_id]
            );

            if (existentes.length > 0) {
                // Actualizar cantidad
                const nuevaCantidad = existentes[0].cantidad + cantidad;
                await db.query(
                    'UPDATE carrito SET cantidad = ? WHERE id = ?',
                    [nuevaCantidad, existentes[0].id]
                );
            } else {
                // Insertar nuevo item
                await db.query(
                    'INSERT INTO carrito (usuario_id, producto_id, cantidad) VALUES (?, ?, ?)',
                    [usuarioId, producto_id, cantidad]
                );
            }

            res.json({
                success: true,
                message: 'Producto agregado al carrito'
            });

        } catch (error) {
            console.error('❌ Error al agregar al carrito:', error);
            res.status(500).json({
                success: false,
                message: 'Error al agregar producto al carrito'
            });
        }
    },

    // ✅ ACTUALIZAR CANTIDAD DE UN ITEM
    actualizarCantidad: async (req, res) => {
        try {
            const { itemId } = req.params;
            const { cantidad } = req.body;
            const usuarioId = req.usuario.id;

            if (cantidad < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'La cantidad debe ser mayor a 0'
                });
            }

            // Verificar que el item pertenece al usuario
            const [items] = await db.query(
                'SELECT c.*, p.stock FROM carrito c INNER JOIN productos p ON c.producto_id = p.id WHERE c.id = ? AND c.usuario_id = ?',
                [itemId, usuarioId]
            );

            if (items.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Item no encontrado'
                });
            }

            if (items[0].stock < cantidad) {
                return res.status(400).json({
                    success: false,
                    message: 'Stock insuficiente'
                });
            }

            await db.query(
                'UPDATE carrito SET cantidad = ? WHERE id = ?',
                [cantidad, itemId]
            );

            res.json({
                success: true,
                message: 'Cantidad actualizada'
            });

        } catch (error) {
            console.error('❌ Error al actualizar cantidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar cantidad'
            });
        }
    },

    // ✅ ELIMINAR ITEM DEL CARRITO
    eliminarItem: async (req, res) => {
        try {
            const { itemId } = req.params;
            const usuarioId = req.usuario.id;

            await db.query(
                'DELETE FROM carrito WHERE id = ? AND usuario_id = ?',
                [itemId, usuarioId]
            );

            res.json({
                success: true,
                message: 'Item eliminado del carrito'
            });

        } catch (error) {
            console.error('❌ Error al eliminar item:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar item'
            });
        }
    },

    // ✅ VACIAR CARRITO
    vaciar: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;

            await db.query(
                'DELETE FROM carrito WHERE usuario_id = ?',
                [usuarioId]
            );

            res.json({
                success: true,
                message: 'Carrito vaciado'
            });

        } catch (error) {
            console.error('❌ Error al vaciar carrito:', error);
            res.status(500).json({
                success: false,
                message: 'Error al vaciar carrito'
            });
        }
    },

    // ✅ VERIFICAR STOCK
    verificarStock: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;

            const [items] = await db.query(
                `SELECT 
                    c.id,
                    c.cantidad,
                    p.stock as stock_disponible,
                    p.nombre
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.usuario_id = ?`,
                [usuarioId]
            );

            const sinStock = items.filter(item => item.cantidad > item.stock_disponible);
            const stockDisponible = sinStock.length === 0;

            res.json({
                success: true,
                data: {
                    stockDisponible,
                    itemsSinStock: sinStock
                }
            });

        } catch (error) {
            console.error('❌ Error al verificar stock:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar stock'
            });
        }
    }
};

module.exports = carritoController;