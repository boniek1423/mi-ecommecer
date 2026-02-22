// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware');

// ============= VALIDACIONES =============

// Validaciones para registro
const validacionesRegistro = [
    body('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .trim()
        .escape(),
    
    body('email')
        .isEmail().withMessage('Email válido requerido')
        .normalizeEmail()
        .toLowerCase(),
    
    body('password')
        .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('La contraseña debe contener al menos una letra y un número'),
    
    body('direccion')
        .optional()
        .trim()
        .escape(),
    
    body('telefono')
        .optional()
        .isMobilePhone('es-MX').withMessage('Teléfono válido requerido')
        .trim()
];

// Validaciones para login
const validacionesLogin = [
    body('email')
        .isEmail().withMessage('Email válido requerido')
        .normalizeEmail()
        .toLowerCase(),
    
    body('password')
        .notEmpty().withMessage('La contraseña es requerida')
];

// Validaciones para actualizar perfil
const validacionesActualizarPerfil = [
    body('nombre')
        .optional()
        .notEmpty().withMessage('El nombre no puede estar vacío')
        .trim()
        .escape(),
    
    body('direccion')
        .optional()
        .trim()
        .escape(),
    
    body('telefono')
        .optional()
        .isMobilePhone('es-MX').withMessage('Teléfono válido requerido')
        .trim()
];

// Validaciones para cambiar contraseña
const validacionesCambiarPassword = [
    body('passwordActual')
        .notEmpty().withMessage('La contraseña actual es requerida'),
    body('passwordNueva')
        .isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('La nueva contraseña debe contener al menos una letra y un número')
];

// Validaciones para recuperar contraseña
const validacionesRecuperarPassword = [
    body('email')
        .isEmail().withMessage('Email válido requerido')
        .normalizeEmail()
        .toLowerCase()
];

// Validaciones para restablecer contraseña
const validacionesRestablecerPassword = [
    body('token')
        .notEmpty().withMessage('El token es requerido'),
    body('password')
        .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('La contraseña debe contener al menos una letra y un número')
];

// Validaciones para cambiar rol (admin)
const validacionesCambiarRol = [
    body('rol')
        .isIn(['usuario', 'admin']).withMessage('Rol no válido. Debe ser "usuario" o "admin"')
];

// ============= RUTAS PÚBLICAS (NO REQUIEREN TOKEN) =============

/**
 * @route   POST /api/auth/registro
 * @desc    Registrar un nuevo usuario
 * @access  Público
 */
router.post('/registro', validacionesRegistro, authController.registro);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Público
 */
router.post('/login', validacionesLogin, authController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión (solo para compatibilidad con frontend)
 * @access  Público
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/recuperar-password
 * @desc    Solicitar recuperación de contraseña
 * @access  Público
 */
router.post('/recuperar-password', 
    validacionesRecuperarPassword,
    authController.recuperarPassword
);

/**
 * @route   POST /api/auth/restablecer-password
 * @desc    Restablecer contraseña con token
 * @access  Público
 */
router.post('/restablecer-password', 
    validacionesRestablecerPassword,
    authController.restablecerPassword
);

// 🔴 RUTA COMENTADA TEMPORALMENTE - Implementar después si es necesario
// router.get('/verificar-email/:token', authController.verificarEmail);

// ============= RUTAS PROTEGIDAS (REQUIEREN TOKEN VÁLIDO) =============

/**
 * @route   GET /api/auth/perfil
 * @desc    Obtener perfil del usuario autenticado
 * @access  Privado (requiere token)
 */
router.get('/perfil', authMiddleware, authController.perfil);

/**
 * @route   PUT /api/auth/perfil
 * @desc    Actualizar perfil del usuario autenticado
 * @access  Privado (requiere token)
 */
router.put('/perfil', 
    authMiddleware, 
    validacionesActualizarPerfil,
    authController.actualizarPerfil
);

/**
 * @route   POST /api/auth/cambiar-password
 * @desc    Cambiar contraseña del usuario autenticado
 * @access  Privado (requiere token)
 */
router.post('/cambiar-password',
    authMiddleware,
    validacionesCambiarPassword,
    authController.cambiarPassword
);

/**
 * @route   GET /api/auth/verificar-token
 * @desc    Verificar si el token es válido
 * @access  Privado (requiere token)
 */
router.get('/verificar-token', authMiddleware, authController.verificarToken);

/**
 * @route   DELETE /api/auth/eliminar-cuenta
 * @desc    Eliminar la propia cuenta del usuario
 * @access  Privado (requiere token)
 */
router.delete('/eliminar-cuenta',
    authMiddleware,
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    authController.eliminarMiCuenta
);

// ============= RUTAS DE ADMINISTRADOR (REQUIEREN TOKEN Y ROL ADMIN) =============

/**
 * @route   GET /api/auth/usuarios
 * @desc    Obtener todos los usuarios (solo admin)
 * @access  Privado (requiere token y rol admin)
 */
router.get('/usuarios', authMiddleware, adminMiddleware, authController.listarUsuarios);

/**
 * @route   GET /api/auth/usuarios/buscar
 * @desc    Buscar usuarios (solo admin)
 * @access  Privado (requiere token y rol admin)
 */
router.get('/usuarios/buscar', 
    authMiddleware, 
    adminMiddleware, 
    authController.buscarUsuarios
);

/**
 * @route   GET /api/auth/usuarios/estadisticas
 * @desc    Obtener estadísticas de usuarios (solo admin)
 * @access  Privado (requiere token y rol admin)
 */
router.get('/usuarios/estadisticas', 
    authMiddleware, 
    adminMiddleware, 
    authController.obtenerEstadisticas
);

/**
 * @route   GET /api/auth/usuarios/:id
 * @desc    Obtener usuario por ID (solo admin)
 * @access  Privado (requiere token y rol admin)
 */
router.get('/usuarios/:id', authMiddleware, adminMiddleware, authController.obtenerUsuario);

/**
 * @route   PUT /api/auth/usuarios/:id
 * @desc    Actualizar usuario (solo admin)
 * @access  Privado (requiere token y rol admin)
 */
router.put('/usuarios/:id',
    authMiddleware,
    adminMiddleware,
    validacionesActualizarPerfil,
    authController.actualizarUsuario
);

/**
 * @route   PUT /api/auth/usuarios/:id/rol
 * @desc    Cambiar rol de usuario (solo admin)
 * @access  Privado (requiere token y rol admin)
 */
router.put('/usuarios/:id/rol',
    authMiddleware,
    adminMiddleware,
    validacionesCambiarRol,
    authController.cambiarRol
);

/**
 * @route   DELETE /api/auth/usuarios/:id
 * @desc    Eliminar usuario (solo admin)
 * @access  Privado (requiere token y rol admin)
 */
router.delete('/usuarios/:id', 
    authMiddleware, 
    adminMiddleware, 
    authController.eliminarUsuario
);

// ============= RUTA DE INFORMACIÓN =============

/**
 * @route   GET /api/auth
 * @desc    Información de las rutas de autenticación
 * @access  Público
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'API de Autenticación',
        rutas: {
            publicas: [
                { metodo: 'POST', ruta: '/api/auth/registro', desc: 'Registrar usuario' },
                { metodo: 'POST', ruta: '/api/auth/login', desc: 'Iniciar sesión' },
                { metodo: 'POST', ruta: '/api/auth/logout', desc: 'Cerrar sesión' },
                { metodo: 'POST', ruta: '/api/auth/recuperar-password', desc: 'Recuperar contraseña' },
                { metodo: 'POST', ruta: '/api/auth/restablecer-password', desc: 'Restablecer contraseña' }
            ],
            privadas: [
                { metodo: 'GET', ruta: '/api/auth/perfil', desc: 'Ver perfil' },
                { metodo: 'PUT', ruta: '/api/auth/perfil', desc: 'Actualizar perfil' },
                { metodo: 'POST', ruta: '/api/auth/cambiar-password', desc: 'Cambiar contraseña' },
                { metodo: 'GET', ruta: '/api/auth/verificar-token', desc: 'Verificar token' },
                { metodo: 'DELETE', ruta: '/api/auth/eliminar-cuenta', desc: 'Eliminar cuenta' }
            ],
            admin: [
                { metodo: 'GET', ruta: '/api/auth/usuarios', desc: 'Listar usuarios' },
                { metodo: 'GET', ruta: '/api/auth/usuarios/buscar', desc: 'Buscar usuarios' },
                { metodo: 'GET', ruta: '/api/auth/usuarios/estadisticas', desc: 'Estadísticas' },
                { metodo: 'GET', ruta: '/api/auth/usuarios/:id', desc: 'Ver usuario' },
                { metodo: 'PUT', ruta: '/api/auth/usuarios/:id', desc: 'Actualizar usuario' },
                { metodo: 'PUT', ruta: '/api/auth/usuarios/:id/rol', desc: 'Cambiar rol' },
                { metodo: 'DELETE', ruta: '/api/auth/usuarios/:id', desc: 'Eliminar usuario' }
            ]
        }
    });
});

module.exports = router;