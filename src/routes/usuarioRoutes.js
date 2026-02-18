const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Obtener todos los usuarios (solo admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [usuarios] = await db.query(
            'SELECT id, nombre, email, direccion, telefono, rol, fecha_registro FROM usuarios'
        );
        res.json({
            success: true,
            data: usuarios
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// Obtener un usuario por ID (solo admin o el mismo usuario)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar permisos
        if (req.usuario.rol !== 'admin' && req.usuario.id != id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver este usuario'
            });
        }

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
            data: usuarios[0]
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// Actualizar usuario
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, direccion, telefono } = req.body;

        // Verificar permisos
        if (req.usuario.rol !== 'admin' && req.usuario.id != id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para editar este usuario'
            });
        }

        await db.query(
            'UPDATE usuarios SET nombre = ?, direccion = ?, telefono = ? WHERE id = ?',
            [nombre, direccion, telefono, id]
        );

        res.json({
            success: true,
            message: 'Usuario actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

module.exports = router; // <-- Asegúrate que esta línea existe