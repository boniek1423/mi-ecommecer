const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Obtener todas las categorías
router.get('/', async (req, res) => {
    try {
        const [categorias] = await db.query('SELECT * FROM categorias ORDER BY nombre');
        res.json({
            success: true,
            data: categorias
        });
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor' 
        });
    }
});

// Obtener una categoría por ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [categorias] = await db.query('SELECT * FROM categorias WHERE id = ?', [id]);
        
        if (categorias.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        res.json({
            success: true,
            data: categorias[0]
        });
    } catch (error) {
        console.error('Error al obtener categoría:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor' 
        });
    }
});

// Crear una nueva categoría (solo admin)
router.post('/', async (req, res) => {
    try {
        const { nombre, descripcion, imagen_url } = req.body;

        if (!nombre) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la categoría es requerido'
            });
        }

        const [result] = await db.query(
            'INSERT INTO categorias (nombre, descripcion, imagen_url) VALUES (?, ?, ?)',
            [nombre, descripcion || null, imagen_url || null]
        );

        const [nuevaCategoria] = await db.query('SELECT * FROM categorias WHERE id = ?', [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Categoría creada exitosamente',
            data: nuevaCategoria[0]
        });
    } catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor' 
        });
    }
});

// Actualizar una categoría (solo admin)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, imagen_url } = req.body;

        // Verificar si existe
        const [existe] = await db.query('SELECT id FROM categorias WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        // Construir query dinámico
        const updates = [];
        const params = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            params.push(nombre);
        }
        if (descripcion !== undefined) {
            updates.push('descripcion = ?');
            params.push(descripcion);
        }
        if (imagen_url !== undefined) {
            updates.push('imagen_url = ?');
            params.push(imagen_url);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay datos para actualizar'
            });
        }

        params.push(id);
        await db.query(`UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`, params);

        const [categoriaActualizada] = await db.query('SELECT * FROM categorias WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Categoría actualizada exitosamente',
            data: categoriaActualizada[0]
        });
    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor' 
        });
    }
});

// Eliminar una categoría (solo admin)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si tiene productos asociados
        const [productos] = await db.query(
            'SELECT id FROM productos WHERE categoria_id = ? LIMIT 1',
            [id]
        );

        if (productos.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar la categoría porque tiene productos asociados'
            });
        }

        const [result] = await db.query('DELETE FROM categorias WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Categoría eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor' 
        });
    }
});

module.exports = router;