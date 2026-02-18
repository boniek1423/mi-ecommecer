const adminMiddleware = (req, res, next) => {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Acceso denegado. Se requieren permisos de administrador.' 
        });
    }
    next();
};

module.exports = adminMiddleware;