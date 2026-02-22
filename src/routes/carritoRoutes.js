// src/routes/carritoRoutes.js
const express = require('express');
const router = express.Router();
const carritoController = require('../controllers/carritoController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Todas las rutas del carrito requieren autenticación
router.use(authMiddleware);

/**
 * @route   GET /api/carrito
 * @desc    Obtener carrito del usuario
 * @access  Privado
 */
router.get('/', carritoController.obtener);

/**
 * @route   POST /api/carrito/agregar
 * @desc    Agregar producto al carrito
 * @access  Privado
 */
router.post('/agregar', carritoController.agregar);

/**
 * @route   PUT /api/carrito/item/:itemId
 * @desc    Actualizar cantidad de un item
 * @access  Privado
 */
router.put('/item/:itemId', carritoController.actualizarCantidad);

/**
 * @route   DELETE /api/carrito/item/:itemId
 * @desc    Eliminar item del carrito
 * @access  Privado
 */
router.delete('/item/:itemId', carritoController.eliminarItem);

/**
 * @route   DELETE /api/carrito
 * @desc    Vaciar carrito
 * @access  Privado
 */
router.delete('/', carritoController.vaciar);

/**
 * @route   GET /api/carrito/verificar-stock
 * @desc    Verificar stock de items en carrito
 * @access  Privado
 */
router.get('/verificar-stock', carritoController.verificarStock);

module.exports = router;