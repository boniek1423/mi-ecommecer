const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        // Obtener el token del header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Acceso denegado. Token no proporcionado.' 
            });
        }

        // Verificar el token
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = verified; // Guardamos la info del usuario en la request
        
        next(); // Continuamos con la siguiente función
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Token inválido o expirado' 
        });
    }
};

module.exports = authMiddleware;