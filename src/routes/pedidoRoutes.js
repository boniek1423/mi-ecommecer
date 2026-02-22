// src/routes/pedidoRoutes.js
const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

// ============= RUTAS PARA USUARIOS AUTENTICADOS =============
// Todas las rutas en este archivo requieren autenticación
router.use(authMiddleware); // ✅ Esto es correcto, usa authMiddleware como handler

/**
 * @route   POST /api/pedidos
 * @desc    Crear un nuevo pedido desde el carrito
 * @access  Privado
 */
router.post('/', pedidoController.crear);

/**
 * @route   GET /api/pedidos/mis-pedidos
 * @desc    Listar pedidos del usuario actual
 * @access  Privado
 */
router.get('/mis-pedidos', pedidoController.listarMisPedidos);

/**
 * @route   GET /api/pedidos/:id
 * @desc    Obtener detalle de un pedido específico
 * @access  Privado
 */
router.get('/:id', pedidoController.obtenerDetalle);

/**
 * @route   PUT /api/pedidos/:id/cancelar
 * @desc    Cancelar un pedido (solo si está pendiente)
 * @access  Privado
 */
router.put('/:id/cancelar', pedidoController.cancelar);

// ============= RUTAS SOLO PARA ADMIN =============
/**
 * @route   GET /api/pedidos/admin/todos
 * @desc    Listar todos los pedidos (admin)
 * @access  Privado (admin)
 */
router.get('/admin/todos', adminMiddleware, pedidoController.listarTodos);

/**
 * @route   GET /api/pedidos/admin/estadisticas
 * @desc    Obtener estadísticas de pedidos (admin)
 * @access  Privado (admin)
 */
router.get('/admin/estadisticas', adminMiddleware, pedidoController.obtenerEstadisticas);

/**
 * @route   PUT /api/pedidos/admin/:id/estado
 * @desc    Actualizar estado de un pedido (admin)
 * @access  Privado (admin)
 */
router.put('/admin/:id/estado', adminMiddleware, pedidoController.actualizarEstado);

/**
 * @route   GET /api/pedidos/admin/usuario/:usuarioId
 * @desc    Obtener pedidos de un usuario específico (admin)
 * @access  Privado (admin)
 */
router.get('/admin/usuario/:usuarioId', adminMiddleware, pedidoController.obtenerPedidosPorUsuario);

module.exports = router;