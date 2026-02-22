// src/routes/usuarioRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const usuarioController = require('../controllers/usuarioController');
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

// Validaciones para actualizar perfil
const validacionesActualizarPerfil = [
    body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('direccion').optional(),
    body('telefono').optional().isMobilePhone('es-MX').withMessage('Teléfono válido requerido')
];

// Validaciones para cambiar contraseña
const validacionesCambiarPassword = [
    body('passwordActual').notEmpty().withMessage('La contraseña actual es requerida'),
    body('passwordNueva').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
];

// ============= RUTAS PARA USUARIOS AUTENTICADOS =============
// Todas las rutas en este grupo requieren autenticación
router.use(authMiddleware); // ✅ Esto es correcto, usa authMiddleware como handler

/**
 * @route   GET /api/usuarios/perfil
 * @desc    Obtener perfil del usuario actual
 * @access  Privado
 */
router.get('/perfil', usuarioController.obtenerMiPerfil);

/**
 * @route   PUT /api/usuarios/perfil
 * @desc    Actualizar perfil del usuario actual
 * @access  Privado
 */
router.put('/perfil', validacionesActualizarPerfil, usuarioController.actualizarMiPerfil);

/**
 * @route   POST /api/usuarios/cambiar-password
 * @desc    Cambiar contraseña del usuario actual
 * @access  Privado
 */
router.post('/cambiar-password', validacionesCambiarPassword, usuarioController.cambiarMiPassword);

/**
 * @route   DELETE /api/usuarios/cuenta
 * @desc    Eliminar cuenta del usuario actual
 * @access  Privado
 */
router.delete('/cuenta', 
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    usuarioController.eliminarMiCuenta
);

// ============= RUTAS SOLO PARA ADMIN =============
/**
 * @route   GET /api/usuarios
 * @desc    Listar todos los usuarios (admin)
 * @access  Privado (admin)
 */
router.get('/', adminMiddleware, usuarioController.listarUsuarios);

/**
 * @route   GET /api/usuarios/buscar
 * @desc    Buscar usuarios (admin)
 * @access  Privado (admin)
 */
router.get('/buscar', adminMiddleware, usuarioController.buscarUsuarios);

/**
 * @route   GET /api/usuarios/estadisticas
 * @desc    Obtener estadísticas de usuarios (admin)
 * @access  Privado (admin)
 */
router.get('/estadisticas', adminMiddleware, usuarioController.obtenerEstadisticas);

/**
 * @route   GET /api/usuarios/:id
 * @desc    Obtener usuario por ID (admin)
 * @access  Privado (admin)
 */
router.get('/:id', adminMiddleware, usuarioController.obtenerUsuario);

/**
 * @route   PUT /api/usuarios/:id
 * @desc    Actualizar usuario (admin)
 * @access  Privado (admin)
 */
router.put('/:id', adminMiddleware, validacionesActualizarPerfil, usuarioController.actualizarUsuario);

/**
 * @route   PUT /api/usuarios/:id/rol
 * @desc    Cambiar rol de usuario (admin)
 * @access  Privado (admin)
 */
router.put('/:id/rol', 
    adminMiddleware, 
    body('rol').isIn(['usuario', 'admin']).withMessage('Rol no válido'),
    usuarioController.cambiarRol
);

/**
 * @route   DELETE /api/usuarios/:id
 * @desc    Eliminar usuario (admin)
 * @access  Privado (admin)
 */
router.delete('/:id', adminMiddleware, usuarioController.eliminarUsuario);

module.exports = router;