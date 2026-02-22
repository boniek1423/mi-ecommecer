// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación
 * Verifica que el token JWT sea válido y adjunta los datos del usuario a la request
 */
const authMiddleware = (req, res, next) => {
    try {
        // 1. Obtener el token del header Authorization
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                message: 'Acceso denegado. No se proporcionó token de autenticación.',
                code: 'NO_TOKEN'
            });
        }

        // 2. Verificar que el formato sea "Bearer TOKEN"
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Formato de token inválido. Debe ser: Bearer [token]',
                code: 'INVALID_FORMAT'
            });
        }

        // 3. Extraer el token (eliminar "Bearer ")
        const token = authHeader.substring(7); // más eficiente que .replace()
        
        if (!token || token.length < 10) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token inválido o vacío',
                code: 'EMPTY_TOKEN'
            });
        }

        // 4. Verificar que JWT_SECRET existe
        if (!process.env.JWT_SECRET) {
            console.error('❌ ERROR CRÍTICO: JWT_SECRET no está configurado en .env');
            return res.status(500).json({ 
                success: false, 
                message: 'Error de configuración del servidor',
                code: 'SERVER_CONFIG_ERROR'
            });
        }

        // 5. Verificar el token con JWT
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        // 6. Adjuntar la información del usuario a la request
        req.usuario = {
            id: verified.id,
            email: verified.email,
            nombre: verified.nombre,
            rol: verified.rol || 'usuario'
        };
        
        // 7. Opcional: Log para debugging (solo en desarrollo)
        if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Usuario autenticado: ${req.usuario.email} (${req.usuario.rol})`);
        }
        
        // 8. Continuar con la siguiente función/middleware
        next();
        
    } catch (error) {
        // Manejo específico de errores de JWT
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expirado. Por favor inicia sesión nuevamente.',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token inválido. Por favor inicia sesión nuevamente.',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Error genérico
        console.error('Error en authMiddleware:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno al verificar autenticación',
            code: 'AUTH_ERROR'
        });
    }
};

// Middleware opcional para verificar si es administrador
const adminMiddleware = (req, res, next) => {
    if (req.usuario && req.usuario.rol === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: 'Acceso denegado. Se requieren permisos de administrador.',
            code: 'FORBIDDEN'
        });
    }
};

module.exports = {
    authMiddleware,
    adminMiddleware
};