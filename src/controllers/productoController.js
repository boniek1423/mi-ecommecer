const db = require('../config/db');
const { validationResult } = require('express-validator');

const productoController = {
    // OBTENER todos los productos (público)
    getAll: async (req, res) => {
        try {
            let query = `
                SELECT p.*, c.nombre as categoria_nombre 
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
            `;
            
            // Si hay un parámetro de búsqueda
            const { busqueda, categoria, destacado } = req.query;
            const params = [];
            
            if (busqueda || categoria || destacado) {
                query += ' WHERE ';
                const condiciones = [];
                
                if (busqueda) {
                    condiciones.push('(p.nombre LIKE ? OR p.descripcion LIKE ?)');
                    params.push(`%${busqueda}%`, `%${busqueda}%`);
                }
                
                if (categoria) {
                    condiciones.push('p.categoria_id = ?');
                    params.push(categoria);
                }
                
                if (destacado === 'true') {
                    condiciones.push('p.destacado = true');
                }
                
                query += condiciones.join(' AND ');
            }
            
            query += ' ORDER BY p.fecha_creacion DESC';
            
            const [productos] = await db.query(query, params);
            
            res.json({
                success: true,
                data: productos
            });
        } catch (error) {
            console.error('Error al obtener productos:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // OBTENER un producto por ID (público)
    getById: async (req, res) => {
        try {
            const { id } = req.params;
            
            const [productos] = await db.query(`
                SELECT p.*, c.nombre as categoria_nombre 
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = ?
            `, [id]);
            
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
            console.error('Error al obtener producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // CREAR nuevo producto (solo admin)
    create: async (req, res) => {
        try {
            // Validar datos
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { 
                nombre, 
                descripcion, 
                precio, 
                stock, 
                categoria_id, 
                imagen_url,
                destacado 
            } = req.body;

            // Verificar que la categoría exista (si se proporcionó)
            if (categoria_id) {
                const [categoria] = await db.query('SELECT id FROM categorias WHERE id = ?', [categoria_id]);
                if (categoria.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'La categoría seleccionada no existe'
                    });
                }
            }

            // Insertar producto
            const [result] = await db.query(`
                INSERT INTO productos 
                (nombre, descripcion, precio, stock, categoria_id, imagen_url, destacado) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [nombre, descripcion, precio, stock, categoria_id || null, imagen_url || null, destacado || false]);

            // Obtener el producto recién creado
            const [nuevoProducto] = await db.query(`
                SELECT p.*, c.nombre as categoria_nombre 
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = ?
            `, [result.insertId]);

            res.status(201).json({
                success: true,
                message: 'Producto creado exitosamente',
                data: nuevoProducto[0]
            });

        } catch (error) {
            console.error('Error al crear producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // ACTUALIZAR producto (solo admin)
    update: async (req, res) => {
        try {
            const { id } = req.params;
            
            // Validar datos
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            // Verificar que el producto existe
            const [productoExistente] = await db.query('SELECT id FROM productos WHERE id = ?', [id]);
            if (productoExistente.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            const { 
                nombre, 
                descripcion, 
                precio, 
                stock, 
                categoria_id, 
                imagen_url,
                destacado 
            } = req.body;

            // Verificar que la categoría exista (si se proporcionó)
            if (categoria_id) {
                const [categoria] = await db.query('SELECT id FROM categorias WHERE id = ?', [categoria_id]);
                if (categoria.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'La categoría seleccionada no existe'
                    });
                }
            }

            // Construir la consulta de actualización dinámicamente
            const updates = [];
            const params = [];

            if (nombre !== undefined) {
                updates.push('nombre = ?');
                params.push(nombre);
            }
            if (descripcion !== undefined) {
                updates.push('descripcion = ?');
                params.push(descripcion);
            }
            if (precio !== undefined) {
                updates.push('precio = ?');
                params.push(precio);
            }
            if (stock !== undefined) {
                updates.push('stock = ?');
                params.push(stock);
            }
            if (categoria_id !== undefined) {
                updates.push('categoria_id = ?');
                params.push(categoria_id || null);
            }
            if (imagen_url !== undefined) {
                updates.push('imagen_url = ?');
                params.push(imagen_url || null);
            }
            if (destacado !== undefined) {
                updates.push('destacado = ?');
                params.push(destacado);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay datos para actualizar'
                });
            }

            // Agregar el ID al final de los parámetros
            params.push(id);

            // Ejecutar actualización
            await db.query(`
                UPDATE productos 
                SET ${updates.join(', ')} 
                WHERE id = ?
            `, params);

            // Obtener el producto actualizado
            const [productoActualizado] = await db.query(`
                SELECT p.*, c.nombre as categoria_nombre 
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                WHERE p.id = ?
            `, [id]);

            res.json({
                success: true,
                message: 'Producto actualizado exitosamente',
                data: productoActualizado[0]
            });

        } catch (error) {
            console.error('Error al actualizar producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // ELIMINAR producto (solo admin)
    delete: async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar si el producto tiene pedidos asociados
            const [pedidos] = await db.query(
                'SELECT id FROM detalles_pedido WHERE producto_id = ? LIMIT 1',
                [id]
            );

            if (pedidos.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar el producto porque tiene pedidos asociados'
                });
            }

            // Eliminar producto
            const [result] = await db.query('DELETE FROM productos WHERE id = ?', [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            res.json({
                success: true,
                message: 'Producto eliminado exitosamente'
            });

        } catch (error) {
            console.error('Error al eliminar producto:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // ACTUALIZAR STOCK (útil para después de una compra)
    updateStock: async (req, res) => {
        try {
            const { id } = req.params;
            const { cantidad } = req.body;

            if (!cantidad || cantidad < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cantidad inválida'
                });
            }

            // Verificar stock suficiente
            const [producto] = await db.query(
                'SELECT stock FROM productos WHERE id = ?',
                [id]
            );

            if (producto.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado'
                });
            }

            if (producto[0].stock < cantidad) {
                return res.status(400).json({
                    success: false,
                    message: 'Stock insuficiente'
                });
            }

            // Actualizar stock
            await db.query(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                [cantidad, id]
            );

            res.json({
                success: true,
                message: 'Stock actualizado exitosamente'
            });

        } catch (error) {
            console.error('Error al actualizar stock:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    }
};

module.exports = productoController;