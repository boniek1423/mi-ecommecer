// src/routes/productoRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const productoController = require('../controllers/productoController');
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

// Validaciones para crear/actualizar producto
const validacionesProducto = [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('precio').isNumeric().withMessage('El precio debe ser un número'),
    body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero'),
    body('categoria_id').optional().isInt().withMessage('La categoría debe ser un ID válido')
];

// ============= RUTAS PÚBLICAS =============
/**
 * @route   GET /api/productos
 * @desc    Obtener todos los productos
 * @access  Público
 */
router.get('/', productoController.listar);

/**
 * @route   GET /api/productos/:id
 * @desc    Obtener un producto por ID
 * @access  Público
 */
router.get('/:id', productoController.obtenerPorId);

// ============= RUTAS PROTEGIDAS (SOLO ADMIN) =============
/**
 * @route   POST /api/productos
 * @desc    Crear un nuevo producto
 * @access  Privado (solo admin)
 */
router.post('/', 
    authMiddleware, 
    adminMiddleware, 
    validacionesProducto, 
    productoController.crear
);

/**
 * @route   PUT /api/productos/:id
 * @desc    Actualizar un producto
 * @access  Privado (solo admin)
 */
router.put('/:id', 
    authMiddleware, 
    adminMiddleware, 
    validacionesProducto, 
    productoController.actualizar
);

/**
 * @route   DELETE /api/productos/:id
 * @desc    Eliminar un producto
 * @access  Privado (solo admin)
 */
router.delete('/:id', 
    authMiddleware, 
    adminMiddleware, 
    productoController.eliminar
);

module.exports = router;