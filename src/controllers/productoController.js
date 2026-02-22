// src/controllers/productoController.js
const db = require('../config/db');
const { validationResult } = require('express-validator');

const productoController = {
    // ✅ LISTAR TODOS LOS PRODUCTOS
    listar: async (req, res) => {
        try {
            const { busqueda, categoria } = req.query;
            
            let query = `
                SELECT p.*, c.nombre as categoria_nombre 
                FROM productos p 
                LEFT JOIN categorias c ON p.categoria_id = c.id
            `;
            const valores = [];

            if (busqueda || categoria) {
                query += ' WHERE ';
                const condiciones = [];
                
                if (busqueda) {
                    condiciones.push('(p.nombre LIKE ? OR p.descripcion LIKE ?)');
                    valores.push(`%${busqueda}%`, `%${busqueda}%`);
                }
                
                if (categoria) {
                    condiciones.push('p.categoria_id = ?');
                    valores.push(categoria);
                }
                
                query += condiciones.join(' AND ');
            }
            
            query += ' ORDER BY p.id DESC';

            const [productos] = await db.query(query, valores);

            res.json({
                success: true,
                data: productos
            });

        } catch (error) {
            console.error('❌ Error en listar productos:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener productos'
            });
        }
    },

    // ✅ OBTENER PRODUCTO POR ID
    obtenerPorId: async (req, res) => {
        try {
            const { id } = req.params;

            const [productos] = await db.query(
                `SELECT p.*, c.nombre as categoria_nombre 
                 FROM productos p 
                 LEFT JOIN categorias c ON p.categoria_id = c.id 
                 WHERE p.id = ?`,
                [id]
            );

            if (productos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            res.json({
                success: true,
                data: productos[0]
            });

        } catch (error) {
            console.error('❌ Error en obtener producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener producto'
            });
        }
    },

    // ✅ CREAR PRODUCTO (solo admin)
    crear: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { nombre, descripcion, precio, stock, imagen_url, categoria_id } = req.body;

            const [result] = await db.query(
                `INSERT INTO productos (nombre, descripcion, precio, stock, imagen_url, categoria_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [nombre, descripcion || null, precio, stock, imagen_url || null, categoria_id || null]
            );

            const [nuevoProducto] = await db.query(
                'SELECT * FROM productos WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json({
                success: true,
                message: 'Producto creado exitosamente',
                data: nuevoProducto[0]
            });

        } catch (error) {
            console.error('❌ Error en crear producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear producto'
            });
        }
    },

    // ✅ ACTUALIZAR PRODUCTO (solo admin)
    actualizar: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const { nombre, descripcion, precio, stock, imagen_url, categoria_id } = req.body;

            // Verificar si el producto existe
            const [productos] = await db.query('SELECT id FROM productos WHERE id = ?', [id]);
            if (productos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            // Construir la consulta dinámicamente
            let query = 'UPDATE productos SET ';
            const valores = [];
            const campos = [];

            if (nombre) {
                campos.push('nombre = ?');
                valores.push(nombre);
            }
            if (descripcion !== undefined) {
                campos.push('descripcion = ?');
                valores.push(descripcion);
            }
            if (precio) {
                campos.push('precio = ?');
                valores.push(precio);
            }
            if (stock !== undefined) {
                campos.push('stock = ?');
                valores.push(stock);
            }
            if (imagen_url !== undefined) {
                campos.push('imagen_url = ?');
                valores.push(imagen_url);
            }
            if (categoria_id !== undefined) {
                campos.push('categoria_id = ?');
                valores.push(categoria_id);
            }

            if (campos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay datos para actualizar'
                });
            }

            query += campos.join(', ') + ' WHERE id = ?';
            valores.push(id);

            await db.query(query, valores);

            // Obtener el producto actualizado
            const [productoActualizado] = await db.query('SELECT * FROM productos WHERE id = ?', [id]);

            res.json({
                success: true,
                message: 'Producto actualizado exitosamente',
                data: productoActualizado[0]
            });

        } catch (error) {
            console.error('❌ Error en actualizar producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar producto'
            });
        }
    },

    // ✅ ELIMINAR PRODUCTO (solo admin)
    eliminar: async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar si el producto existe
            const [productos] = await db.query('SELECT id FROM productos WHERE id = ?', [id]);
            if (productos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            // Eliminar el producto
            await db.query('DELETE FROM productos WHERE id = ?', [id]);

            res.json({
                success: true,
                message: 'Producto eliminado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error en eliminar producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar producto'
            });
        }
    }
};

module.exports = productoController;