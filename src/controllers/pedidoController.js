const db = require('../config/db');

const pedidoController = {
    // Obtener pedidos del usuario actual
    getMisPedidos: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;
            const { estado, pagina = 1, limite = 10, dias, busqueda } = req.query;
            
            let query = `
                SELECT p.*, 
                       COUNT(dp.id) as total_productos,
                       u.nombre as usuario_nombre
                FROM pedidos p
                INNER JOIN usuarios u ON p.usuario_id = u.id
                LEFT JOIN detalles_pedido dp ON p.id = dp.pedido_id
                WHERE p.usuario_id = ?
            `;
            
            const params = [usuarioId];
            
            // Filtro por estado
            if (estado) {
                query += ' AND p.estado = ?';
                params.push(estado);
            }
            
            // Filtro por días
            if (dias) {
                query += ' AND p.fecha_pedido >= DATE_SUB(NOW(), INTERVAL ? DAY)';
                params.push(parseInt(dias));
            }
            
            // Filtro por búsqueda en productos
            if (busqueda) {
                query += ` AND p.id IN (
                    SELECT DISTINCT pedido_id FROM detalles_pedido dp
                    INNER JOIN productos pr ON dp.producto_id = pr.id
                    WHERE pr.nombre LIKE ?
                )`;
                params.push(`%${busqueda}%`);
            }
            
            query += ' GROUP BY p.id ORDER BY p.fecha_pedido DESC LIMIT ? OFFSET ?';
            
            const offset = (pagina - 1) * limite;
            params.push(parseInt(limite), offset);
            
            const [pedidos] = await db.query(query, params);
            
            // Obtener total de pedidos para paginación
            let countQuery = 'SELECT COUNT(*) as total FROM pedidos WHERE usuario_id = ?';
            const countParams = [usuarioId];
            
            if (estado) {
                countQuery += ' AND estado = ?';
                countParams.push(estado);
            }
            
            const [total] = await db.query(countQuery, countParams);

            // Para cada pedido, obtener sus detalles
            for (let pedido of pedidos) {
                const [detalles] = await db.query(`
                    SELECT 
                        dp.*,
                        p.nombre as producto_nombre,
                        p.imagen_url
                    FROM detalles_pedido dp
                    INNER JOIN productos p ON dp.producto_id = p.id
                    WHERE dp.pedido_id = ?
                `, [pedido.id]);
                
                pedido.detalles = detalles;
                
                // Obtener historial de estados
                const [historial] = await db.query(`
                    SELECT * FROM historial_pedidos 
                    WHERE pedido_id = ? 
                    ORDER BY fecha DESC
                `, [pedido.id]);
                
                pedido.historial = historial;
            }

            res.json({
                success: true,
                data: {
                    pedidos,
                    paginacion: {
                        pagina: parseInt(pagina),
                        limite: parseInt(limite),
                        total: total[0].total,
                        paginas: Math.ceil(total[0].total / limite)
                    }
                }
            });

        } catch (error) {
            console.error('Error al obtener pedidos:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // Obtener un pedido específico
    getPedidoById: async (req, res) => {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;
            const esAdmin = req.usuario.rol === 'admin';

            let query = 'SELECT * FROM pedidos WHERE id = ?';
            const params = [id];

            // Si no es admin, solo puede ver sus propios pedidos
            if (!esAdmin) {
                query += ' AND usuario_id = ?';
                params.push(usuarioId);
            }

            const [pedidos] = await db.query(query, params);

            if (pedidos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido no encontrado'
                });
            }

            const pedido = pedidos[0];

            // Obtener detalles del pedido
            const [detalles] = await db.query(`
                SELECT 
                    dp.*,
                    p.nombre as producto_nombre,
                    p.descripcion,
                    p.imagen_url
                FROM detalles_pedido dp
                INNER JOIN productos p ON dp.producto_id = p.id
                WHERE dp.pedido_id = ?
            `, [id]);

            // Obtener historial de estados
            const [historial] = await db.query(`
                SELECT h.*, u.nombre as usuario_nombre
                FROM historial_pedidos h
                LEFT JOIN usuarios u ON h.creado_por = u.id
                WHERE h.pedido_id = ?
                ORDER BY h.fecha DESC
            `, [id]);

            // Obtener información del usuario
            const [usuario] = await db.query(
                'SELECT id, nombre, email, telefono, direccion FROM usuarios WHERE id = ?',
                [pedido.usuario_id]
            );

            res.json({
                success: true,
                data: {
                    ...pedido,
                    detalles,
                    historial,
                    usuario: usuario[0]
                }
            });

        } catch (error) {
            console.error('Error al obtener pedido:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // Crear pedido manualmente (desde carrito)
    crearPedido: async (req, res) => {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            const usuarioId = req.usuario.id;
            const { direccion_envio, notas } = req.body;

            // Obtener carrito del usuario
            const [items] = await connection.query(`
                SELECT 
                    c.producto_id,
                    c.cantidad,
                    p.precio,
                    p.nombre,
                    p.stock
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.usuario_id = ?
            `, [usuarioId]);

            if (items.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'El carrito está vacío'
                });
            }

            // Verificar stock
            for (const item of items) {
                if (item.stock < item.cantidad) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuficiente para ${item.nombre}`
                    });
                }
            }

            // Calcular total
            const total = items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

            // Obtener dirección del usuario si no se proporcionó
            let direccion = direccion_envio;
            if (!direccion) {
                const [usuario] = await connection.query(
                    'SELECT direccion FROM usuarios WHERE id = ?',
                    [usuarioId]
                );
                direccion = usuario[0]?.direccion || 'Dirección no proporcionada';
            }

            // Crear pedido
            const [pedidoResult] = await connection.query(
                `INSERT INTO pedidos 
                (usuario_id, total, estado, direccion_envio, notas, fecha_pedido) 
                VALUES (?, ?, 'pendiente', ?, ?, NOW())`,
                [usuarioId, total, direccion, notas || null]
            );

            const pedidoId = pedidoResult.insertId;

            // Insertar detalles del pedido
            for (const item of items) {
                await connection.query(
                    `INSERT INTO detalles_pedido 
                    (pedido_id, producto_id, cantidad, precio_unitario) 
                    VALUES (?, ?, ?, ?)`,
                    [pedidoId, item.producto_id, item.cantidad, item.precio]
                );

                // Actualizar stock
                await connection.query(
                    'UPDATE productos SET stock = stock - ? WHERE id = ?',
                    [item.cantidad, item.producto_id]
                );
            }

            // Agregar al historial
            await connection.query(
                `INSERT INTO historial_pedidos 
                (pedido_id, estado, comentario, creado_por, fecha) 
                VALUES (?, 'pendiente', 'Pedido creado', ?, NOW())`,
                [pedidoId, usuarioId]
            );

            // Vaciar carrito
            await connection.query('DELETE FROM carrito WHERE usuario_id = ?', [usuarioId]);

            await connection.commit();

            // Obtener el pedido creado
            const [nuevoPedido] = await connection.query(`
                SELECT p.*, u.nombre as usuario_nombre
                FROM pedidos p
                INNER JOIN usuarios u ON p.usuario_id = u.id
                WHERE p.id = ?
            `, [pedidoId]);

            res.status(201).json({
                success: true,
                message: 'Pedido creado exitosamente',
                data: nuevoPedido[0]
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error al crear pedido:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        } finally {
            connection.release();
        }
    },

    // Actualizar estado del pedido (solo admin)
    actualizarEstado: async (req, res) => {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            const { id } = req.params;
            const { estado, comentario } = req.body;
            const adminId = req.usuario.id;

            const estadosValidos = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
            
            if (!estadosValidos.includes(estado)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Estado no válido'
                });
            }

            // Verificar que el pedido existe
            const [pedidos] = await connection.query(
                'SELECT id, estado FROM pedidos WHERE id = ?',
                [id]
            );

            if (pedidos.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Pedido no encontrado'
                });
            }

            const estadoAnterior = pedidos[0].estado;

            // Actualizar estado
            await connection.query(
                'UPDATE pedidos SET estado = ?, fecha_actualizacion = NOW() WHERE id = ?',
                [estado, id]
            );

            // Registrar en historial
            await connection.query(
                `INSERT INTO historial_pedidos 
                (pedido_id, estado, comentario, creado_por, fecha) 
                VALUES (?, ?, ?, ?, NOW())`,
                [id, estado, comentario || `Estado cambiado de ${estadoAnterior} a ${estado}`, adminId]
            );

            // Si se cancela el pedido, restaurar stock
            if (estado === 'cancelado' && estadoAnterior !== 'cancelado') {
                const [detalles] = await connection.query(
                    'SELECT producto_id, cantidad FROM detalles_pedido WHERE pedido_id = ?',
                    [id]
                );

                for (const detalle of detalles) {
                    await connection.query(
                        'UPDATE productos SET stock = stock + ? WHERE id = ?',
                        [detalle.cantidad, detalle.producto_id]
                    );
                }
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Estado actualizado exitosamente'
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error al actualizar estado:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        } finally {
            connection.release();
        }
    },

    // Obtener todos los pedidos (solo admin)
    getAllPedidos: async (req, res) => {
        try {
            const { 
                estado, 
                usuario_id, 
                fecha_desde, 
                fecha_hasta,
                pagina = 1, 
                limite = 20,
                busqueda
            } = req.query;

            let query = `
                SELECT 
                    p.*,
                    u.nombre as usuario_nombre,
                    u.email as usuario_email,
                    COUNT(dp.id) as total_productos
                FROM pedidos p
                INNER JOIN usuarios u ON p.usuario_id = u.id
                LEFT JOIN detalles_pedido dp ON p.id = dp.pedido_id
                WHERE 1=1
            `;
            
            const params = [];

            if (estado) {
                query += ' AND p.estado = ?';
                params.push(estado);
            }

            if (usuario_id) {
                query += ' AND p.usuario_id = ?';
                params.push(usuario_id);
            }

            if (fecha_desde) {
                query += ' AND DATE(p.fecha_pedido) >= ?';
                params.push(fecha_desde);
            }

            if (fecha_hasta) {
                query += ' AND DATE(p.fecha_pedido) <= ?';
                params.push(fecha_hasta);
            }

            if (busqueda) {
                query += ` AND (p.id LIKE ? OR u.nombre LIKE ? OR u.email LIKE ?)`;
                params.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
            }

            query += ' GROUP BY p.id ORDER BY p.fecha_pedido DESC LIMIT ? OFFSET ?';
            
            const offset = (pagina - 1) * limite;
            params.push(parseInt(limite), offset);

            const [pedidos] = await db.query(query, params);

            // Obtener total para paginación
            let countQuery = 'SELECT COUNT(*) as total FROM pedidos p WHERE 1=1';
            const countParams = [];
            
            if (estado) {
                countQuery += ' AND p.estado = ?';
                countParams.push(estado);
            }
            if (usuario_id) {
                countQuery += ' AND p.usuario_id = ?';
                countParams.push(usuario_id);
            }

            const [total] = await db.query(countQuery, countParams);

            res.json({
                success: true,
                data: {
                    pedidos,
                    paginacion: {
                        pagina: parseInt(pagina),
                        limite: parseInt(limite),
                        total: total[0].total,
                        paginas: Math.ceil(total[0].total / limite)
                    }
                }
            });

        } catch (error) {
            console.error('Error al obtener pedidos:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    },

    // Cancelar pedido (usuario)
    cancelarPedido: async (req, res) => {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            const { id } = req.params;
            const usuarioId = req.usuario.id;
            const { motivo } = req.body;

            // Verificar que el pedido pertenece al usuario y está pendiente
            const [pedidos] = await connection.query(
                'SELECT id, estado FROM pedidos WHERE id = ? AND usuario_id = ?',
                [id, usuarioId]
            );

            if (pedidos.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Pedido no encontrado'
                });
            }

            const pedido = pedidos[0];

            if (pedido.estado !== 'pendiente') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Solo se pueden cancelar pedidos pendientes'
                });
            }

            // Actualizar estado
            await connection.query(
                'UPDATE pedidos SET estado = "cancelado", fecha_actualizacion = NOW() WHERE id = ?',
                [id]
            );

            // Registrar en historial
            await connection.query(
                `INSERT INTO historial_pedidos 
                (pedido_id, estado, comentario, creado_por, fecha) 
                VALUES (?, 'cancelado', ?, ?, NOW())`,
                [id, motivo || 'Cancelado por el usuario', usuarioId]
            );

            // Restaurar stock
            const [detalles] = await connection.query(
                'SELECT producto_id, cantidad FROM detalles_pedido WHERE pedido_id = ?',
                [id]
            );

            for (const detalle of detalles) {
                await connection.query(
                    'UPDATE productos SET stock = stock + ? WHERE id = ?',
                    [detalle.cantidad, detalle.producto_id]
                );
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Pedido cancelado exitosamente'
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error al cancelar pedido:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        } finally {
            connection.release();
        }
    },

    // Obtener estadísticas de pedidos (admin)
    getEstadisticas: async (req, res) => {
        try {
            // Verificar que sea admin
            if (req.usuario.rol !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado'
                });
            }

            // Pedidos por estado
            const [porEstado] = await db.query(`
                SELECT 
                    estado,
                    COUNT(*) as total,
                    COALESCE(SUM(total), 0) as monto_total
                FROM pedidos
                GROUP BY estado
            `);

            // Pedidos por día (últimos 30 días)
            const [porDia] = await db.query(`
                SELECT 
                    DATE(fecha_pedido) as fecha,
                    COUNT(*) as total_pedidos,
                    COALESCE(SUM(total), 0) as ventas
                FROM pedidos
                WHERE fecha_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(fecha_pedido)
                ORDER BY fecha DESC
            `);

            // Productos más vendidos
            const [productosVendidos] = await db.query(`
                SELECT 
                    p.id,
                    p.nombre,
                    COALESCE(SUM(dp.cantidad), 0) as total_vendido,
                    COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) as ingresos
                FROM detalles_pedido dp
                INNER JOIN productos p ON dp.producto_id = p.id
                INNER JOIN pedidos ped ON dp.pedido_id = ped.id
                WHERE ped.estado != 'cancelado'
                GROUP BY p.id, p.nombre
                ORDER BY total_vendido DESC
                LIMIT 10
            `);

            // Total de productos
            const [totalProductos] = await db.query(`
                SELECT COUNT(*) as total FROM productos
            `);

            // Total de usuarios
            const [totalUsuarios] = await db.query(`
                SELECT COUNT(*) as total FROM usuarios
            `);

            // Ventas totales
            const [ventasTotales] = await db.query(`
                SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE estado != 'cancelado'
            `);

            res.json({
                success: true,
                data: {
                    porEstado,
                    porDia,
                    productosVendidos,
                    totalProductos: totalProductos[0].total,
                    totalUsuarios: totalUsuarios[0].total,
                    ventasTotales: ventasTotales[0].total
                }
            });

        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cargar estadísticas'
            });
        }
    },

    // Obtener resumen rápido para dashboard
    getResumen: async (req, res) => {
        try {
            // Total de pedidos hoy
            const [pedidosHoy] = await db.query(`
                SELECT COUNT(*) as total FROM pedidos 
                WHERE DATE(fecha_pedido) = CURDATE()
            `);

            // Total de ventas hoy
            const [ventasHoy] = await db.query(`
                SELECT COALESCE(SUM(total), 0) as total FROM pedidos 
                WHERE DATE(fecha_pedido) = CURDATE() AND estado != 'cancelado'
            `);

            // Pedidos pendientes
            const [pendientes] = await db.query(`
                SELECT COUNT(*) as total FROM pedidos WHERE estado = 'pendiente'
            `);

            // Productos con bajo stock
            const [bajoStock] = await db.query(`
                SELECT COUNT(*) as total FROM productos WHERE stock < 10
            `);

            res.json({
                success: true,
                data: {
                    pedidosHoy: pedidosHoy[0].total,
                    ventasHoy: ventasHoy[0].total,
                    pendientes: pendientes[0].total,
                    bajoStock: bajoStock[0].total
                }
            });

        } catch (error) {
            console.error('Error al obtener resumen:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cargar resumen'
            });
        }
    }
};

module.exports = pedidoController;