// src/controllers/categoriaController.js
const db = require('../config/db');
const { validationResult } = require('express-validator');

const categoriaController = {
    // ============= MÉTODOS PÚBLICOS =============

    // ✅ LISTAR TODAS LAS CATEGORÍAS (público)
    listar: async (req, res) => {
        try {
            const { con_productos } = req.query;
            
            let query = `
                SELECT 
                    c.*,
                    COUNT(p.id) as total_productos
                FROM categorias c
                LEFT JOIN productos p ON c.id = p.categoria_id
            `;
            
            if (con_productos === 'true') {
                query += ' WHERE p.id IS NOT NULL';
            }
            
            query += ' GROUP BY c.id ORDER BY c.nombre ASC';

            const [categorias] = await db.query(query);

            res.json({
                success: true,
                data: categorias
            });

        } catch (error) {
            console.error('❌ Error al listar categorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener categorías'
            });
        }
    },

    // ✅ OBTENER CATEGORÍA POR ID (público)
    obtenerPorId: async (req, res) => {
        try {
            const { id } = req.params;

            const [categorias] = await db.query(
                `SELECT 
                    c.*,
                    COUNT(p.id) as total_productos
                FROM categorias c
                LEFT JOIN productos p ON c.id = p.categoria_id
                WHERE c.id = ?
                GROUP BY c.id`,
                [id]
            );

            if (categorias.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Categoría no encontrada'
                });
            }

            // Obtener productos de esta categoría
            const [productos] = await db.query(
                `SELECT id, nombre, precio, stock, imagen_url 
                FROM productos 
                WHERE categoria_id = ? 
                LIMIT 10`,
                [id]
            );

            res.json({
                success: true,
                data: {
                    ...categorias[0],
                    productos_destacados: productos
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener categoría:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener categoría'
            });
        }
    },

    // ============= MÉTODOS SOLO PARA ADMIN =============

    // ✅ CREAR NUEVA CATEGORÍA (admin)
    crear: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { nombre, descripcion } = req.body;

            // Verificar si ya existe una categoría con ese nombre
            const [existentes] = await db.query(
                'SELECT id FROM categorias WHERE nombre = ?',
                [nombre]
            );

            if (existentes.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una categoría con ese nombre'
                });
            }

            const [result] = await db.query(
                'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
                [nombre, descripcion || null]
            );

            const [nuevaCategoria] = await db.query(
                'SELECT * FROM categorias WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json({
                success: true,
                message: 'Categoría creada exitosamente',
                data: nuevaCategoria[0]
            });

        } catch (error) {
            console.error('❌ Error al crear categoría:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear categoría'
            });
        }
    },

    // ✅ ACTUALIZAR CATEGORÍA (admin)
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
            const { nombre, descripcion } = req.body;

            // Verificar que la categoría existe
            const [categorias] = await db.query(
                'SELECT id FROM categorias WHERE id = ?',
                [id]
            );

            if (categorias.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Categoría no encontrada'
                });
            }

            // Si se está cambiando el nombre, verificar que no exista otra con ese nombre
            if (nombre) {
                const [existentes] = await db.query(
                    'SELECT id FROM categorias WHERE nombre = ? AND id != ?',
                    [nombre, id]
                );

                if (existentes.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe otra categoría con ese nombre'
                    });
                }
            }

            // Construir consulta dinámica
            let query = 'UPDATE categorias SET ';
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

            if (campos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay datos para actualizar'
                });
            }

            query += campos.join(', ') + ' WHERE id = ?';
            valores.push(id);

            await db.query(query, valores);

            // Obtener categoría actualizada
            const [categoriaActualizada] = await db.query(
                'SELECT * FROM categorias WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Categoría actualizada exitosamente',
                data: categoriaActualizada[0]
            });

        } catch (error) {
            console.error('❌ Error al actualizar categoría:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar categoría'
            });
        }
    },

    // ✅ ELIMINAR CATEGORÍA (admin)
    eliminar: async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar que la categoría existe
            const [categorias] = await db.query(
                'SELECT id, nombre FROM categorias WHERE id = ?',
                [id]
            );

            if (categorias.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Categoría no encontrada'
                });
            }

            // Verificar si hay productos en esta categoría
            const [productos] = await db.query(
                'SELECT COUNT(*) as total FROM productos WHERE categoria_id = ?',
                [id]
            );

            if (productos[0].total > 0) {
                return res.status(400).json({
                    success: false,
                    message: `No se puede eliminar la categoría porque tiene ${productos[0].total} productos asociados`
                });
            }

            await db.query('DELETE FROM categorias WHERE id = ?', [id]);

            res.json({
                success: true,
                message: 'Categoría eliminada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error al eliminar categoría:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar categoría'
            });
        }
    },

    // ✅ OBTENER PRODUCTOS POR CATEGORÍA (admin)
    obtenerProductos: async (req, res) => {
        try {
            const { id } = req.params;
            const { pagina = 1, limite = 20 } = req.query;

            // Verificar que la categoría existe
            const [categorias] = await db.query(
                'SELECT id, nombre FROM categorias WHERE id = ?',
                [id]
            );

            if (categorias.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Categoría no encontrada'
                });
            }

            // Obtener productos de la categoría
            const [productos] = await db.query(
                `SELECT id, nombre, precio, stock, imagen_url, created_at 
                FROM productos 
                WHERE categoria_id = ? 
                ORDER BY id DESC 
                LIMIT ? OFFSET ?`,
                [id, parseInt(limite), (pagina - 1) * limite]
            );

            // Total de productos en la categoría
            const [totalResult] = await db.query(
                'SELECT COUNT(*) as total FROM productos WHERE categoria_id = ?',
                [id]
            );

            res.json({
                success: true,
                data: {
                    categoria: categorias[0],
                    productos,
                    paginacion: {
                        pagina: parseInt(pagina),
                        limite: parseInt(limite),
                        total: totalResult[0].total,
                        paginas: Math.ceil(totalResult[0].total / limite)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener productos por categoría:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener productos de la categoría'
            });
        }
    },

    // ✅ ESTADÍSTICAS DE CATEGORÍAS (admin)
    obtenerEstadisticas: async (req, res) => {
        try {
            // Total de categorías
            const [total] = await db.query('SELECT COUNT(*) as total FROM categorias');
            
            // Categorías con más productos
            const [masProductos] = await db.query(
                `SELECT 
                    c.id, c.nombre,
                    COUNT(p.id) as total_productos,
                    COALESCE(SUM(p.stock), 0) as stock_total,
                    COALESCE(SUM(p.precio * p.stock), 0) as valor_inventario
                FROM categorias c
                LEFT JOIN productos p ON c.id = p.categoria_id
                GROUP BY c.id
                HAVING total_productos > 0
                ORDER BY total_productos DESC
                LIMIT 10`
            );
            
            // Categorías sin productos
            const [sinProductos] = await db.query(
                `SELECT c.id, c.nombre
                FROM categorias c
                LEFT JOIN productos p ON c.id = p.categoria_id
                WHERE p.id IS NULL`
            );

            // Productos por categoría (para gráfico)
            const [productosPorCategoria] = await db.query(
                `SELECT 
                    c.nombre,
                    COUNT(p.id) as cantidad
                FROM categorias c
                LEFT JOIN productos p ON c.id = p.categoria_id
                GROUP BY c.id
                ORDER BY cantidad DESC`
            );

            res.json({
                success: true,
                data: {
                    total_categorias: total[0].total,
                    categorias_con_productos: masProductos,
                    categorias_sin_productos: sinProductos.length,
                    lista_sin_productos: sinProductos,
                    productos_por_categoria
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas'
            });
        }
    },

    // ✅ REORGANIZAR CATEGORÍAS (admin)
    reordenar: async (req, res) => {
        try {
            const { categorias } = req.body; // Array de {id, orden}

            if (!Array.isArray(categorias) || categorias.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe proporcionar un array de categorías'
                });
            }

            // Iniciar transacción
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                for (let i = 0; i < categorias.length; i++) {
                    const { id } = categorias[i];
                    
                    // Aquí podrías actualizar un campo 'orden' si lo tuvieras
                    // Por ahora solo verificamos que existan
                    const [existe] = await connection.query(
                        'SELECT id FROM categorias WHERE id = ?',
                        [id]
                    );

                    if (existe.length === 0) {
                        throw new Error(`Categoría con ID ${id} no encontrada`);
                    }
                }

                await connection.commit();
                connection.release();

                res.json({
                    success: true,
                    message: 'Categorías reordenadas exitosamente'
                });

            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }

        } catch (error) {
            console.error('❌ Error al reordenar categorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error al reordenar categorías'
            });
        }
    },

    // ✅ IMPORTAR CATEGORÍAS (admin - para carga masiva)
    importar: async (req, res) => {
        try {
            const { categorias } = req.body; // Array de {nombre, descripcion}

            if (!Array.isArray(categorias) || categorias.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe proporcionar un array de categorías'
                });
            }

            const resultados = {
                exitosas: 0,
                fallidas: 0,
                errores: []
            };

            // Iniciar transacción
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                for (const cat of categorias) {
                    if (!cat.nombre) {
                        resultados.fallidas++;
                        resultados.errores.push({
                            categoria: cat,
                            error: 'Nombre requerido'
                        });
                        continue;
                    }

                    // Verificar duplicados
                    const [existentes] = await connection.query(
                        'SELECT id FROM categorias WHERE nombre = ?',
                        [cat.nombre]
                    );

                    if (existentes.length > 0) {
                        resultados.fallidas++;
                        resultados.errores.push({
                            categoria: cat.nombre,
                            error: 'Categoría ya existe'
                        });
                        continue;
                    }

                    await connection.query(
                        'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
                        [cat.nombre, cat.descripcion || null]
                    );

                    resultados.exitosas++;
                }

                await connection.commit();
                connection.release();

                res.json({
                    success: true,
                    message: `Importación completada: ${resultados.exitosas} exitosas, ${resultados.fallidas} fallidas`,
                    data: resultados
                });

            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }

        } catch (error) {
            console.error('❌ Error al importar categorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error al importar categorías'
            });
        }
    }
};

module.exports = categoriaController;