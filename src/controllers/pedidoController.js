// src/controllers/pedidoController.js
const db = require('../config/db');

const pedidoController = {
    
    // ✅ CREAR PEDIDO DESDE EL CARRITO - VERSIÓN FINAL
    crear: async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { direccion_envio, telefono_contacto, metodo_pago } = req.body;

        // Validar datos básicos
        if (!direccion_envio || !telefono_contacto || !metodo_pago) {
            return res.status(400).json({
                success: false,
                message: 'Dirección, teléfono y método de pago son requeridos'
            });
        }

        // Obtener items del carrito
        const [itemsCarrito] = await db.query(
            `SELECT 
                c.producto_id,
                c.cantidad,
                p.precio,
                p.stock,
                p.nombre
            FROM carrito c
            INNER JOIN productos p ON c.producto_id = p.id
            WHERE c.usuario_id = ?`,
            [usuarioId]
        );

        if (itemsCarrito.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'El carrito está vacío'
            });
        }

        // Verificar stock
        for (const item of itemsCarrito) {
            if (item.cantidad > item.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente para ${item.nombre}. Disponible: ${item.stock}`
                });
            }
        }

        // Calcular total
        const total = itemsCarrito.reduce((sum, item) => 
            sum + (item.precio * item.cantidad), 0
        );

        // Iniciar transacción
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Crear el pedido (fecha_pedido se asigna automáticamente)
            const [resultPedido] = await connection.query(
                `INSERT INTO pedidos 
                (usuario_id, total, estado, direccion_envio, telefono_contacto, metodo_pago) 
                VALUES (?, ?, 'pendiente', ?, ?, ?)`,
                [usuarioId, total, direccion_envio, telefono_contacto, metodo_pago]
            );

            const pedidoId = resultPedido.insertId;

            // 2. Insertar detalles del pedido y actualizar stock
            for (const item of itemsCarrito) {
                // Insertar detalle
                await connection.query(
                    `INSERT INTO pedido_detalles 
                    (pedido_id, producto_id, cantidad, precio_unitario, subtotal) 
                    VALUES (?, ?, ?, ?, ?)`,
                    [pedidoId, item.producto_id, item.cantidad, item.precio, item.precio * item.cantidad]
                );

                // Actualizar stock
                await connection.query(
                    'UPDATE productos SET stock = stock - ? WHERE id = ?',
                    [item.cantidad, item.producto_id]
                );
            }

            // 3. Vaciar el carrito
            await connection.query(
                'DELETE FROM carrito WHERE usuario_id = ?',
                [usuarioId]
            );

            await connection.commit();
            connection.release();

            res.status(201).json({
                success: true,
                message: 'Pedido creado exitosamente',
                data: { 
                    pedido_id: pedidoId, 
                    total,
                    fecha: new Date().toISOString() // Para referencia
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('❌ Error al crear pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear el pedido'
        });
    }
    },

    // ✅ LISTAR MIS PEDIDOS - CORREGIDO
    listarMisPedidos: async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { pagina = 1, limite = 10 } = req.query;

        // Contar total
        const [totalResult] = await db.query(
            'SELECT COUNT(*) as total FROM pedidos WHERE usuario_id = ?',
            [usuarioId]
        );
        const total = totalResult[0].total;

        // 👇 CORREGIDO: fecha_pedido
        const [pedidos] = await db.query(
            `SELECT * FROM pedidos 
            WHERE usuario_id = ? 
            ORDER BY fecha_pedido DESC 
            LIMIT ? OFFSET ?`,
            [usuarioId, parseInt(limite), (pagina - 1) * limite]
        );

        res.json({
            success: true,
            data: pedidos,
            paginacion: {
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total,
                paginas: Math.ceil(total / limite)
            }
        });

    } catch (error) {
        console.error('❌ Error al listar pedidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pedidos'
        });
    }
    },

    // ✅ OBTENER DETALLE DE PEDIDO
    obtenerDetalle: async (req, res) => {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;

            const [pedidos] = await db.query(
                `SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?`,
                [id, usuarioId]
            );

            if (pedidos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido no encontrado'
                });
            }

            const [detalles] = await db.query(
                `SELECT pd.*, p.nombre, p.imagen_url 
                FROM pedido_detalles pd
                INNER JOIN productos p ON pd.producto_id = p.id
                WHERE pd.pedido_id = ?`,
                [id]
            );

            res.json({
                success: true,
                data: {
                    pedido: pedidos[0],
                    detalles
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener detalle:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener detalle del pedido'
            });
        }
    },

    // ✅ CANCELAR PEDIDO
    cancelar: async (req, res) => {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;

            const [pedidos] = await db.query(
                'SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?',
                [id, usuarioId]
            );

            if (pedidos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido no encontrado'
                });
            }

            if (pedidos[0].estado !== 'pendiente') {
                return res.status(400).json({
                    success: false,
                    message: 'Solo se pueden cancelar pedidos pendientes'
                });
            }

            await db.query(
                'UPDATE pedidos SET estado = ? WHERE id = ?',
                ['cancelado', id]
            );

            res.json({
                success: true,
                message: 'Pedido cancelado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error al cancelar pedido:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cancelar pedido'
            });
        }
    },

    // ✅ LISTAR TODOS LOS PEDIDOS (ADMIN) - CORREGIDO
    listarTodos: async (req, res) => {
    try {
        const { pagina = 1, limite = 10, estado } = req.query;
        
        let query = `
            SELECT p.*, u.nombre as usuario_nombre, u.email 
            FROM pedidos p
            INNER JOIN usuarios u ON p.usuario_id = u.id
        `;
        
        const valores = [];
        
        if (estado) {
            query += ' WHERE p.estado = ?';
            valores.push(estado);
        }
        
        // Contar total para paginación
        const countQuery = query.replace(
            'SELECT p.*, u.nombre as usuario_nombre, u.email',
            'SELECT COUNT(*) as total'
        );
        
        const [totalResult] = await db.query(countQuery, valores);
        const total = totalResult[0].total;
        
        // 👇 CORREGIDO: fecha_pedido en lugar de created_at o fecha_registro
        query += ' ORDER BY p.fecha_pedido DESC LIMIT ? OFFSET ?';
        const offset = (pagina - 1) * limite;
        valores.push(parseInt(limite), offset);

        const [pedidos] = await db.query(query, valores);

        res.json({
            success: true,
            data: pedidos,
            paginacion: {
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total,
                paginas: Math.ceil(total / limite)
            }
        });

    } catch (error) {
        console.error('❌ Error al listar todos los pedidos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pedidos'
        });
    }
},
   
    // ✅ OBTENER ESTADÍSTICAS (ADMIN) - CORREGIDO
    obtenerEstadisticas: async (req, res) => {
    try {
        // Total de pedidos
        const [total] = await db.query('SELECT COUNT(*) as total FROM pedidos');
        
        // Pedidos por estado
        const [porEstado] = await db.query(
            'SELECT estado, COUNT(*) as cantidad FROM pedidos GROUP BY estado'
        );
        
        // 👇 CORREGIDO: fecha_pedido
        const [ultimoMes] = await db.query(
            `SELECT DATE(fecha_pedido) as fecha, COUNT(*) as cantidad 
            FROM pedidos 
            WHERE fecha_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(fecha_pedido)
            ORDER BY fecha DESC`
        );
        
        // Total de ingresos (excluyendo cancelados)
        const [ingresos] = await db.query(
            'SELECT SUM(total) as total_ingresos FROM pedidos WHERE estado != "cancelado"'
        );

        res.json({
            success: true,
            data: {
                total_pedidos: total[0].total,
                pedidos_por_estado: porEstado,
                pedidos_ultimo_mes: ultimoMes,
                total_ingresos: ingresos[0].total_ingresos || 0
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

    // ✅ ACTUALIZAR ESTADO (ADMIN)
    actualizarEstado: async (req, res) => {
        try {
            const { id } = req.params;
            const { estado } = req.body;

            const estadosValidos = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];
            
            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado no válido'
                });
            }

            await db.query(
                'UPDATE pedidos SET estado = ? WHERE id = ?',
                [estado, id]
            );

            res.json({
                success: true,
                message: 'Estado actualizado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error al actualizar estado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar estado'
            });
        }
    },

    
    // ✅ OBTENER PEDIDOS POR USUARIO (ADMIN) - CORREGIDO
    obtenerPedidosPorUsuario: async (req, res) => {
    try {
        const { usuarioId } = req.params;

        // 👇 CORREGIDO: fecha_pedido
        const [pedidos] = await db.query(
            'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY fecha_pedido DESC',
            [usuarioId]
        );

        res.json({
            success: true,
            data: pedidos
        });

    } catch (error) {
        console.error('❌ Error al obtener pedidos del usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pedidos'
        });
    }
},
};

module.exports = pedidoController;