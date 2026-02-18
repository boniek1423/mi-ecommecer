const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const productoController = require('../controllers/productoController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Validaciones para crear/actualizar productos
const validacionesProducto = [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
    body('stock').optional().isInt({ min: 0 }).withMessage('El stock debe ser un número entero positivo'),
    body('categoria_id').optional().isInt().withMessage('ID de categoría inválido'),
    body('destacado').optional().isBoolean().withMessage('Destacado debe ser true o false')
];

// Rutas públicas
router.get('/', productoController.getAll);
router.get('/:id', productoController.getById);

// Rutas protegidas (solo admin)
router.post('/', 
    authMiddleware, 
    adminMiddleware, 
    validacionesProducto, 
    productoController.create
);

router.put('/:id', 
    authMiddleware, 
    adminMiddleware, 
    validacionesProducto, 
    productoController.update
);

router.delete('/:id', 
    authMiddleware, 
    adminMiddleware, 
    productoController.delete
);

// Ruta especial para actualizar stock (puede ser usada por el sistema)
router.patch('/:id/stock', 
    authMiddleware, 
    productoController.updateStock
);

module.exports = router;