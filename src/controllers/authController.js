// src/controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const authController = {
    // ✅ REGISTRO de nuevo usuario
    registro: async (req, res) => {
        try {
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
                    nombre: nombre,
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
                    direccion: direccion || null,
                    telefono: telefono || null,
                    rol: 'cliente'
                }
            });

        } catch (error) {
            console.error('❌ Error en registro:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error del servidor al registrar usuario' 
            });
        }
    },

    // ✅ LOGIN de usuario
    login: async (req, res) => {
        try {
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
                'SELECT id, nombre, email, password, direccion, telefono, rol FROM usuarios WHERE email = ?',
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
                    nombre: usuario.nombre,
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
                    direccion: usuario.direccion,
                    telefono: usuario.telefono,
                    rol: usuario.rol
                }
            });

        } catch (error) {
            console.error('❌ Error en login:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error del servidor al iniciar sesión' 
            });
        }
    },

    // ✅ PERFIL del usuario actual
 // ✅ PERFIL del usuario actual - CORREGIDO
perfil: async (req, res) => {
    try {
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
        console.error('❌ Error al obtener perfil:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor al obtener perfil' 
        });
    }
},
    // ✅ ACTUALIZAR PERFIL del usuario
    actualizarPerfil: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    success: false, 
                    errors: errors.array() 
                });
            }

            const { nombre, direccion, telefono } = req.body;
            const usuarioId = req.usuario.id;

            // Construir la consulta dinámicamente
            let query = 'UPDATE usuarios SET ';
            const valores = [];
            const campos = [];

            if (nombre) {
                campos.push('nombre = ?');
                valores.push(nombre);
            }
            if (direccion !== undefined) {
                campos.push('direccion = ?');
                valores.push(direccion);
            }
            if (telefono !== undefined) {
                campos.push('telefono = ?');
                valores.push(telefono);
            }

            if (campos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay datos para actualizar'
                });
            }

            query += campos.join(', ') + ' WHERE id = ?';
            valores.push(usuarioId);

            await db.query(query, valores);

            // Obtener el usuario actualizado
            const [usuarios] = await db.query(
                'SELECT id, nombre, email, direccion, telefono, rol FROM usuarios WHERE id = ?',
                [usuarioId]
            );

            res.json({
                success: true,
                message: 'Perfil actualizado exitosamente',
                usuario: usuarios[0]
            });

        } catch (error) {
            console.error('❌ Error al actualizar perfil:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error del servidor al actualizar perfil' 
            });
        }
    },

    // ✅ CAMBIAR CONTRASEÑA
    cambiarPassword: async (req, res) => {
        try {
            const { passwordActual, passwordNueva } = req.body;
            const usuarioId = req.usuario.id;

            // Obtener la contraseña actual del usuario
            const [usuarios] = await db.query(
                'SELECT password FROM usuarios WHERE id = ?',
                [usuarioId]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Verificar la contraseña actual
            const passwordValida = await bcrypt.compare(passwordActual, usuarios[0].password);
            
            if (!passwordValida) {
                return res.status(401).json({
                    success: false,
                    message: 'La contraseña actual es incorrecta'
                });
            }

            // Encriptar la nueva contraseña
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(passwordNueva, salt);

            // Actualizar la contraseña
            await db.query(
                'UPDATE usuarios SET password = ? WHERE id = ?',
                [passwordHash, usuarioId]
            );

            res.json({
                success: true,
                message: 'Contraseña actualizada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error al cambiar contraseña:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error del servidor al cambiar contraseña' 
            });
        }
    },

    // ✅ LOGOUT
    logout: (req, res) => {
        res.json({ 
            success: true, 
            message: 'Sesión cerrada exitosamente' 
        });
    },

    // ✅ VERIFICAR TOKEN
    verificarToken: async (req, res) => {
        try {
            res.json({
                success: true,
                message: 'Token válido',
                usuario: req.usuario
            });
        } catch (error) {
            console.error('❌ Error al verificar token:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar token'
            });
        }
    },

    // ✅ ELIMINAR MI PROPIA CUENTA
    eliminarMiCuenta: async (req, res) => {
        try {
            const { password } = req.body;
            const usuarioId = req.usuario.id;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Debes proporcionar tu contraseña para eliminar la cuenta'
                });
            }

            // Verificar contraseña
            const [usuarios] = await db.query(
                'SELECT password FROM usuarios WHERE id = ?',
                [usuarioId]
            );

            const passwordValida = await bcrypt.compare(password, usuarios[0].password);
            
            if (!passwordValida) {
                return res.status(401).json({
                    success: false,
                    message: 'Contraseña incorrecta'
                });
            }

            // Iniciar transacción
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // Eliminar carrito del usuario
                await connection.query('DELETE FROM carrito WHERE usuario_id = ?', [usuarioId]);
                
                // Eliminar pedidos del usuario
                await connection.query('DELETE FROM pedidos WHERE usuario_id = ?', [usuarioId]);
                
                // Eliminar usuario
                await connection.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);

                await connection.commit();
                connection.release();

                res.json({
                    success: true,
                    message: 'Cuenta eliminada exitosamente'
                });

            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }

        } catch (error) {
            console.error('❌ Error al eliminar cuenta:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar cuenta'
            });
        }
    },

    // 🔴 RECUPERAR CONTRASEÑA (enviar email)
    recuperarPassword: async (req, res) => {
        try {
            const { email } = req.body;
            
            // Verificar si el usuario existe
            const [usuarios] = await db.query(
                'SELECT id, nombre FROM usuarios WHERE email = ?',
                [email]
            );
            
            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No existe una cuenta con este email'
                });
            }

            // Generar token de recuperación (válido por 1 hora)
            const resetToken = jwt.sign(
                { id: usuarios[0].id, type: 'reset' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Aquí enviarías el email con el token
            console.log('📧 Token de recuperación:', resetToken);

            res.json({
                success: true,
                message: 'Se ha enviado un email con instrucciones para recuperar tu contraseña',
                resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
            });

        } catch (error) {
            console.error('❌ Error en recuperarPassword:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar la solicitud'
            });
        }
    },

    // 🔴 RESTABLECER CONTRASEÑA (con token)
    restablecerPassword: async (req, res) => {
        try {
            const { token, password } = req.body;

            // Verificar el token
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    message: 'Token inválido o expirado'
                });
            }

            // Verificar que es un token de restablecimiento
            if (decoded.type !== 'reset') {
                return res.status(401).json({
                    success: false,
                    message: 'Token inválido'
                });
            }

            // Encriptar nueva contraseña
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Actualizar contraseña
            await db.query(
                'UPDATE usuarios SET password = ? WHERE id = ?',
                [passwordHash, decoded.id]
            );

            res.json({
                success: true,
                message: 'Contraseña actualizada exitosamente'
            });

        } catch (error) {
            console.error('❌ Error en restablecerPassword:', error);
            res.status(500).json({
                success: false,
                message: 'Error al restablecer la contraseña'
            });
        }
    },

    // 🔴 LISTAR TODOS LOS USUARIOS (solo admin)
    listarUsuarios: async (req, res) => {
        try {
            const [usuarios] = await db.query(
                'SELECT id, nombre, email, direccion, telefono, rol, created_at FROM usuarios ORDER BY id DESC'
            );

            res.json({
                success: true,
                data: usuarios
            });

        } catch (error) {
            console.error('❌ Error en listarUsuarios:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener usuarios'
            });
        }
    },

    // 🔴 BUSCAR USUARIOS (solo admin)
    buscarUsuarios: async (req, res) => {
        try {
            const { termino } = req.query;

            if (!termino || termino.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'El término de búsqueda debe tener al menos 2 caracteres'
                });
            }

            const [usuarios] = await db.query(
                `SELECT id, nombre, email, telefono, rol 
                FROM usuarios 
                WHERE nombre LIKE ? OR email LIKE ? OR telefono LIKE ?
                LIMIT 20`,
                [`%${termino}%`, `%${termino}%`, `%${termino}%`]
            );

            res.json({
                success: true,
                data: usuarios
            });

        } catch (error) {
            console.error('❌ Error al buscar usuarios:', error);
            res.status(500).json({
                success: false,
                message: 'Error al buscar usuarios'
            });
        }
    },

    // 🔴 OBTENER ESTADÍSTICAS DE USUARIOS (solo admin)
    obtenerEstadisticas: async (req, res) => {
        try {
            // Total de usuarios
            const [total] = await db.query('SELECT COUNT(*) as total FROM usuarios');
            
            // Usuarios por rol
            const [porRol] = await db.query(
                'SELECT rol, COUNT(*) as cantidad FROM usuarios GROUP BY rol'
            );
            
            // Usuarios nuevos en el último mes
            const [nuevosUltimoMes] = await db.query(
                `SELECT DATE(created_at) as fecha, COUNT(*) as cantidad 
                FROM usuarios 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at)
                ORDER BY fecha DESC`
            );

            res.json({
                success: true,
                data: {
                    total_usuarios: total[0].total,
                    usuarios_por_rol: porRol,
                    nuevos_ultimo_mes: nuevosUltimoMes
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas'
            });
        }
    },

    // 🔴 OBTENER USUARIO POR ID (solo admin)
    obtenerUsuario: async (req, res) => {
        try {
            const { id } = req.params;

            const [usuarios] = await db.query(
                'SELECT id, nombre, email, direccion, telefono, rol, created_at FROM usuarios WHERE id = ?',
                [id]
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
            console.error('❌ Error en obtenerUsuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener usuario'
            });
        }
    },

    // 🔴 ACTUALIZAR USUARIO (solo admin)
    actualizarUsuario: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const { nombre, direccion, telefono } = req.body;

            // Verificar que el usuario existe
            const [usuarios] = await db.query('SELECT id FROM usuarios WHERE id = ?', [id]);
            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Construir consulta dinámica
            let query = 'UPDATE usuarios SET ';
            const valores = [];
            const campos = [];

            if (nombre) {
                campos.push('nombre = ?');
                valores.push(nombre);
            }
            if (direccion !== undefined) {
                campos.push('direccion = ?');
                valores.push(direccion);
            }
            if (telefono !== undefined) {
                campos.push('telefono = ?');
                valores.push(telefono);
            }

            if (campos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay datos para actualizar'
                });
            }

            query += campos.join(', ') + ' WHERE id = ?';
            valores.push(id);

            await db.query(query, valores);

            // Obtener usuario actualizado
            const [usuarioActualizado] = await db.query(
                'SELECT id, nombre, email, direccion, telefono, rol FROM usuarios WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Usuario actualizado exitosamente',
                data: usuarioActualizado[0]
            });

        } catch (error) {
            console.error('❌ Error al actualizar usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar usuario'
            });
        }
    },

    // 🔴 CAMBIAR ROL DE USUARIO (solo admin)
    cambiarRol: async (req, res) => {
        try {
            const { id } = req.params;
            const { rol } = req.body;

            // Validar rol
            if (!['usuario', 'admin'].includes(rol)) {
                return res.status(400).json({
                    success: false,
                    message: 'Rol no válido'
                });
            }

            // Verificar que el usuario existe
            const [usuarios] = await db.query(
                'SELECT id FROM usuarios WHERE id = ?',
                [id]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // No permitir cambiar el rol del propio admin
            if (parseInt(id) === req.usuario.id) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes cambiar tu propio rol'
                });
            }

            // Actualizar rol
            await db.query(
                'UPDATE usuarios SET rol = ? WHERE id = ?',
                [rol, id]
            );

            res.json({
                success: true,
                message: 'Rol actualizado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error en cambiarRol:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar rol'
            });
        }
    },

    // 🔴 ELIMINAR USUARIO (solo admin)
    eliminarUsuario: async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar que el usuario existe
            const [usuarios] = await db.query(
                'SELECT id FROM usuarios WHERE id = ?',
                [id]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // No permitir eliminarse a sí mismo
            if (parseInt(id) === req.usuario.id) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes eliminar tu propio usuario'
                });
            }

            // Iniciar transacción
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // Eliminar carrito del usuario
                await connection.query('DELETE FROM carrito WHERE usuario_id = ?', [id]);
                
                // Eliminar pedidos del usuario
                await connection.query('DELETE FROM pedidos WHERE usuario_id = ?', [id]);
                
                // Eliminar usuario
                await connection.query('DELETE FROM usuarios WHERE id = ?', [id]);

                await connection.commit();
                connection.release();

                res.json({
                    success: true,
                    message: 'Usuario eliminado exitosamente'
                });

            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }

        } catch (error) {
            console.error('❌ Error en eliminarUsuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar usuario'
            });
        }
    },

    // ✅ VERIFICAR EMAIL (para confirmación de email)
    verificarEmail: async (req, res) => {
        try {
            const { token } = req.params;
            
            // Verificar el token
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    message: 'Token inválido o expirado'
                });
            }

            // Verificar que es un token de verificación de email
            if (decoded.type !== 'email_verification') {
                return res.status(401).json({
                    success: false,
                    message: 'Token inválido'
                });
            }

            // Verificar que el usuario existe
            const [usuarios] = await db.query(
                'SELECT id FROM usuarios WHERE id = ?',
                [decoded.id]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Actualizar usuario como verificado (necesitas agregar columna email_verificado a la tabla)
            await db.query(
                'UPDATE usuarios SET email_verificado = true WHERE id = ?',
                [decoded.id]
            );

            res.json({
                success: true,
                message: 'Email verificado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error al verificar email:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar email'
            });
        }
    }
};

module.exports = authController;