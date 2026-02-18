const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const authController = {
    // REGISTRO de nuevo usuario
    registro: async (req, res) => {
        try {
            // Validar los datos de entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { nombre, email, password, direccion, telefono } = req.body;

            // Verificar si el usuario ya existe
            const [usuariosExistentes] = await db.query(
                'SELECT id FROM usuarios WHERE email = ?',
                [email]
            );

            if (usuariosExistentes.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'El email ya está registrado' 
                });
            }

            // Encriptar la contraseña
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Insertar el nuevo usuario
            const [result] = await db.query(
                `INSERT INTO usuarios (nombre, email, password, direccion, telefono, rol) 
                 VALUES (?, ?, ?, ?, ?, 'cliente')`,
                [nombre, email, passwordHash, direccion || null, telefono || null]
            );

            // Generar token JWT
            const token = jwt.sign(
                { 
                    id: result.insertId, 
                    email: email,
                    rol: 'cliente' 
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.status(201).json({
                success: true,
                message: 'Usuario registrado exitosamente',
                token,
                usuario: {
                    id: result.insertId,
                    nombre,
                    email,
                    rol: 'cliente'
                }
            });

        } catch (error) {
            console.error('Error en registro:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error del servidor' 
            });
        }
    },

    // LOGIN de usuario
    login: async (req, res) => {
        try {
            // Validar los datos de entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { email, password } = req.body;

            // Buscar el usuario por email
            const [usuarios] = await db.query(
                'SELECT id, nombre, email, password, rol FROM usuarios WHERE email = ?',
                [email]
            );

            if (usuarios.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Email o contraseña incorrectos' 
                });
            }

            const usuario = usuarios[0];

            // Verificar la contraseña
            const passwordValida = await bcrypt.compare(password, usuario.password);
            
            if (!passwordValida) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Email o contraseña incorrectos' 
                });
            }

            // Generar token JWT
            const token = jwt.sign(
                { 
                    id: usuario.id, 
                    email: usuario.email,
                    rol: usuario.rol 
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                success: true,
                message: 'Login exitoso',
                token,
                usuario: {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    email: usuario.email,
                    rol: usuario.rol
                }
            });

        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error del servidor' 
            });
        }
    },

    // OBTENER perfil del usuario actual
    perfil: async (req, res) => {
        try {
            // req.usuario viene del middleware authMiddleware
            const [usuarios] = await db.query(
                'SELECT id, nombre, email, direccion, telefono, rol, fecha_registro FROM usuarios WHERE id = ?',
                [req.usuario.id]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Usuario no encontrado' 
                });
            }

            res.json({
                success: true,
                usuario: usuarios[0]
            });

        } catch (error) {
            console.error('Error al obtener perfil:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error del servidor' 
            });
        }
    },

    // CERRAR SESIÓN (solo para el frontend, el token se invalida desde el cliente)
    logout: (req, res) => {
        res.json({ 
            success: true, 
            message: 'Sesión cerrada exitosamente' 
        });
    }
};

module.exports = authController;