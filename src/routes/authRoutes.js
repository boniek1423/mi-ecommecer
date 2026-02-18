const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Validaciones para registro
const validacionesRegistro = [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('email').isEmail().withMessage('Email válido requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('telefono').optional().isMobilePhone().withMessage('Teléfono válido requerido')
];

// Validaciones para login
const validacionesLogin = [
    body('email').isEmail().withMessage('Email válido requerido'),
    body('password').notEmpty().withMessage('La contraseña es requerida')
];

// Rutas públicas
router.post('/registro', validacionesRegistro, authController.registro);
router.post('/login', validacionesLogin, authController.login);
router.post('/logout', authController.logout);

// Rutas protegidas (requieren token)
router.get('/perfil', authMiddleware, authController.perfil);

module.exports = router;