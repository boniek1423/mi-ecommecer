// src/controllers/usuarioController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const usuarioController = {
    // ============= MÉTODOS PARA EL PROPIO USUARIO =============

    // ✅ OBTENER MI PERFIL
    obtenerMiPerfil: async (req, res) => {
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
                message: 'Error al obtener perfil'
            });
        }
    },

    // ✅ ACTUALIZAR MI PERFIL
    actualizarMiPerfil: async (req, res) => {
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
            valores.push(usuarioId);

            await db.query(query, valores);

            // Obtener usuario actualizado
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
                message: 'Error al actualizar perfil'
            });
        }
    },

    // ✅ CAMBIAR MI CONTRASEÑA
    cambiarMiPassword: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { passwordActual, passwordNueva } = req.body;
            const usuarioId = req.usuario.id;

            // Obtener contraseña actual
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

            // Verificar contraseña actual
            const passwordValida = await bcrypt.compare(passwordActual, usuarios[0].password);
            
            if (!passwordValida) {
                return res.status(401).json({
                    success: false,
                    message: 'La contraseña actual es incorrecta'
                });
            }

            // Encriptar nueva contraseña
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(passwordNueva, salt);

            // Actualizar contraseña
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
                message: 'Error al cambiar contraseña'
            });
        }
    },

    // ✅ ELIMINAR MI CUENTA
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

    // ============= MÉTODOS SOLO PARA ADMIN =============

    // ✅ LISTAR TODOS LOS USUARIOS
  // src/controllers/usuarioController.js
// ✅ LISTAR TODOS LOS USUARIOS - CORREGIDO
listarUsuarios: async (req, res) => {
    try {
        const [usuarios] = await db.query(
            'SELECT id, nombre, email, direccion, telefono, rol, fecha_registro FROM usuarios ORDER BY id DESC'
        );

        res.json({
            success: true,
            data: usuarios
        });

    } catch (error) {
        console.error('❌ Error en listarUsuarios:', error); // Esto mostrará el error exacto
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios',
            error: error.message // Temporalmente muestra el error para depurar
        });
    }
},

    // ✅ BUSCAR USUARIOS
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

    // ✅ OBTENER ESTADÍSTICAS
    obtenerEstadisticas: async (req, res) => {
        try {
            const [total] = await db.query('SELECT COUNT(*) as total FROM usuarios');
            
            const [porRol] = await db.query(
                'SELECT rol, COUNT(*) as cantidad FROM usuarios GROUP BY rol'
            );

            res.json({
                success: true,
                data: {
                    total_usuarios: total[0].total,
                    usuarios_por_rol: porRol
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

    // ✅ OBTENER USUARIO POR ID
    obtenerUsuario: async (req, res) => {
        try {
            const { id } = req.params;

            const [usuarios] = await db.query(
                'SELECT id, nombre, email, direccion, telefono, rol, fecha_registro FROM usuarios WHERE id = ?',
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
            console.error('❌ Error al obtener usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener usuario'
            });
        }
    },

    // ✅ ACTUALIZAR USUARIO (admin)
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

    // ✅ CAMBIAR ROL
    cambiarRol: async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const { rol } = req.body;

            // Verificar que el usuario existe
            const [usuarios] = await db.query('SELECT id FROM usuarios WHERE id = ?', [id]);
            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // No permitir cambiar el propio rol
            if (parseInt(id) === req.usuario.id) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes cambiar tu propio rol'
                });
            }

            await db.query(
                'UPDATE usuarios SET rol = ? WHERE id = ?',
                [rol, id]
            );

            res.json({
                success: true,
                message: 'Rol actualizado exitosamente'
            });

        } catch (error) {
            console.error('❌ Error al cambiar rol:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar rol'
            });
        }
    },

    // ✅ ELIMINAR USUARIO (admin)
    eliminarUsuario: async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar que el usuario existe
            const [usuarios] = await db.query('SELECT id FROM usuarios WHERE id = ?', [id]);
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
                await connection.query('DELETE FROM carrito WHERE usuario_id = ?', [id]);
                await connection.query('DELETE FROM pedidos WHERE usuario_id = ?', [id]);
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
            console.error('❌ Error al eliminar usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar usuario'
            });
        }
    }
};

module.exports = usuarioController;