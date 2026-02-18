const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========
// Todas las rutas requieren autenticación
router.use(authMiddleware);

// ========== RUTAS PARA USUARIOS (CLIENTES) ==========

/**
 * @route   GET /api/pedidos/mis-pedidos
 * @desc    Obtener los pedidos del usuario actual
 * @access  Privado (usuario autenticado)
 */
router.get('/mis-pedidos', pedidoController.getMisPedidos);

/**
 * @route   GET /api/pedidos/:id
 * @desc    Obtener un pedido específico por ID
 * @access  Privado (usuario dueño del pedido o admin)
 */
router.get('/:id', pedidoController.getPedidoById);

/**
 * @route   POST /api/pedidos
 * @desc    Crear un nuevo pedido desde el carrito
 * @access  Privado (usuario autenticado)
 */
router.post('/', pedidoController.crearPedido);

/**
 * @route   POST /api/pedidos/:id/cancelar
 * @desc    Cancelar un pedido (solo si está pendiente)
 * @access  Privado (usuario dueño del pedido)
 */
router.post('/:id/cancelar', pedidoController.cancelarPedido);

// ========== RUTAS PARA ADMINISTRADORES ==========

/**
 * @route   GET /api/pedidos/admin/todos
 * @desc    Obtener todos los pedidos (con filtros opcionales)
 * @access  Privado (solo admin)
 * @query   ?estado=pagado&usuario_id=1&fecha_desde=2024-01-01&pagina=1&limite=20&busqueda=texto
 */
router.get('/admin/todos', adminMiddleware, pedidoController.getAllPedidos);

/**
 * @route   GET /api/pedidos/admin/estadisticas
 * @desc    Obtener estadísticas completas para el dashboard
 * @access  Privado (solo admin)
 */
router.get('/admin/estadisticas', adminMiddleware, pedidoController.getEstadisticas);

/**
 * @route   GET /api/pedidos/admin/resumen
 * @desc    Obtener resumen rápido para el dashboard (pedidos hoy, ventas hoy, etc.)
 * @access  Privado (solo admin)
 */
router.get('/admin/resumen', adminMiddleware, pedidoController.getResumen);

/**
 * @route   PUT /api/pedidos/:id/estado
 * @desc    Actualizar el estado de un pedido
 * @access  Privado (solo admin)
 * @body    { estado: "enviado", comentario: "Opcional" }
 */
router.put('/:id/estado', adminMiddleware, pedidoController.actualizarEstado);

module.exports = router;