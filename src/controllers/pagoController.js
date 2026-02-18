const Stripe = require('stripe');
const db = require('../config/db');

// Inicializar Stripe con la clave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const pagoController = {
    // Crear sesión de pago
    crearSesionPago: async (req, res) => {
        try {
            const usuarioId = req.usuario.id;

            // Obtener el carrito del usuario con detalles de productos
            const [items] = await db.query(`
                SELECT 
                    c.id as carrito_id,
                    c.cantidad,
                    p.id as producto_id,
                    p.nombre,
                    p.descripcion,
                    p.precio,
                    p.imagen_url
                FROM carrito c
                INNER JOIN productos p ON c.producto_id = p.id
                WHERE c.usuario_id = ?
            `, [usuarioId]);

            if (items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El carrito está vacío'
                });
            }

            // Verificar stock antes de crear la sesión
            for (const item of items) {
                const [producto] = await db.query(
                    'SELECT stock FROM productos WHERE id = ?',
                    [item.producto_id]
                );
                
                if (producto[0].stock < item.cantidad) {
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuficiente para ${item.nombre}`
                    });
                }
            }

            // Crear line_items para Stripe
            const lineItems = items.map(item => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.nombre,
                        description: item.descripcion?.substring(0, 100) || 'Producto',
                        images: item.imagen_url ? [item.imagen_url] : [],
                    },
                    unit_amount: Math.round(item.precio * 100), // Stripe usa centavos
                },
                quantity: item.cantidad,
            }));

            // Crear sesión de checkout en Stripe
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                success_url: `${process.env.APP_URL}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.APP_URL}/carrito`,
                customer_email: req.usuario.email,
                metadata: {
                    usuario_id: usuarioId,
                    items: JSON.stringify(items.map(i => ({ 
                        producto_id: i.producto_id, 
                        cantidad: i.cantidad 
                    })))
                },
                shipping_address_collection: {
                    allowed_countries: ['US', 'MX', 'ES', 'CO', 'AR'], // Países permitidos
                },
            });

            // Guardar la sesión en la base de datos
            await db.query(
                `INSERT INTO sesiones_pago 
                (usuario_id, stripe_session_id, estado, total, items, fecha_creacion) 
                VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    usuarioId, 
                    session.id, 
                    'pendiente', 
                    items.reduce((sum, i) => sum + (i.precio * i.cantidad), 0),
                    JSON.stringify(items)
                ]
            );

            res.json({
                success: true,
                sessionId: session.id,
                url: session.url
            });

        } catch (error) {
            console.error('Error al crear sesión de pago:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar el pago'
            });
        }
    },

    // Webhook para recibir eventos de Stripe
    webhook: async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            // Verificar que el webhook viene de Stripe
            event = stripe.webhooks.constructEvent(
                req.rawBody, // Necesitaremos configurar raw body
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('Error verificando webhook:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Manejar diferentes tipos de eventos
        switch (event.type) {
            case 'checkout.session.completed':
                await manejarPagoExitoso(event.data.object);
                break;
            case 'checkout.session.expired':
                await manejarSesionExpirada(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                await manejarPagoFallido(event.data.object);
                break;
            default:
                console.log(`Evento no manejado: ${event.type}`);
        }

        res.json({ received: true });
    },

    // Verificar estado de un pago
    verificarPago: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const usuarioId = req.usuario.id;

            const [sesiones] = await db.query(
                `SELECT * FROM sesiones_pago 
                 WHERE stripe_session_id = ? AND usuario_id = ?`,
                [sessionId, usuarioId]
            );

            if (sesiones.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Sesión no encontrada'
                });
            }

            const sesion = sesiones[0];

            // Si el pago fue exitoso, obtener detalles del pedido
            if (sesion.estado === 'completado') {
                const [pedido] = await db.query(
                    `SELECT p.*, sp.stripe_session_id 
                     FROM pedidos p
                     INNER JOIN sesiones_pago sp ON p.id = sp.pedido_id
                     WHERE sp.id = ?`,
                    [sesion.id]
                );

                res.json({
                    success: true,
                    estado: sesion.estado,
                    pedido: pedido[0] || null
                });
            } else {
                res.json({
                    success: true,
                    estado: sesion.estado
                });
            }

        } catch (error) {
            console.error('Error verificando pago:', error);
            res.status(500).json({
                success: false,
                message: 'Error del servidor'
            });
        }
    }
};

// Funciones auxiliares para manejar eventos de Stripe
async function manejarPagoExitoso(session) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const usuarioId = session.metadata.usuario_id;
        const items = JSON.parse(session.metadata.items);

        // 1. Actualizar estado de la sesión
        await connection.query(
            `UPDATE sesiones_pago 
             SET estado = 'completado', fecha_completado = NOW() 
             WHERE stripe_session_id = ?`,
            [session.id]
        );

        // 2. Crear el pedido
        const [pedidoResult] = await connection.query(
            `INSERT INTO pedidos 
            (usuario_id, total, estado, direccion_envio, stripe_session_id) 
            VALUES (?, ?, 'pagado', ?, ?)`,
            [
                usuarioId,
                session.amount_total / 100,
                session.shipping?.address ? 
                    `${session.shipping.address.line1}, ${session.shipping.address.city}` : 
                    'Dirección no proporcionada',
                session.id
            ]
        );

        // 3. Agregar detalles del pedido y actualizar stock
        for (const item of items) {
            await connection.query(
                `INSERT INTO detalles_pedido 
                (pedido_id, producto_id, cantidad, precio_unitario) 
                VALUES (?, ?, ?, ?)`,
                [pedidoResult.insertId, item.producto_id, item.cantidad, item.precio]
            );

            // Actualizar stock
            await connection.query(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                [item.cantidad, item.producto_id]
            );
        }

        // 4. Vaciar el carrito
        await connection.query('DELETE FROM carrito WHERE usuario_id = ?', [usuarioId]);

        await connection.commit();
        console.log(`✅ Pedido creado exitosamente: ${pedidoResult.insertId}`);

    } catch (error) {
        await connection.rollback();
        console.error('Error procesando pago exitoso:', error);
    } finally {
        connection.release();
    }
}

async function manejarSesionExpirada(session) {
    await db.query(
        'UPDATE sesiones_pago SET estado = "expirado" WHERE stripe_session_id = ?',
        [session.id]
    );
    console.log(`⏰ Sesión expirada: ${session.id}`);
}

async function manejarPagoFallido(paymentIntent) {
    // Buscar la sesión relacionada con este payment intent
    const [sesiones] = await db.query(
        'SELECT * FROM sesiones_pago WHERE metadata LIKE ?',
        [`%${paymentIntent.id}%`]
    );

    if (sesiones.length > 0) {
        await db.query(
            'UPDATE sesiones_pago SET estado = "fallido" WHERE id = ?',
            [sesiones[0].id]
        );
        console.log(`❌ Pago fallido: ${paymentIntent.id}`);
    }
}

module.exports = pagoController;