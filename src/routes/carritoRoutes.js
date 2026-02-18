const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const carritoController = require('../controllers/carritoController');
const authMiddleware = require('../middlewares/authMiddleware');

// Validaciones
const validacionesAgregar = [
    body('producto_id').isInt().withMessage('ID de producto inválido'),
    body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser al menos 1')
];

const validacionesActualizar = [
    body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser al menos 1')
];

// Todas las rutas del carrito requieren autenticación
router.use(authMiddleware);

// Rutas del carrito
router.get('/', carritoController.getCarrito);
router.post('/agregar', validacionesAgregar, carritoController.agregarProducto);
router.put('/item/:itemId', validacionesActualizar, carritoController.actualizarCantidad);
router.delete('/item/:itemId', carritoController.eliminarProducto);
router.delete('/', carritoController.vaciarCarrito);
router.get('/verificar-stock', carritoController.verificarStock);

module.exports = router;