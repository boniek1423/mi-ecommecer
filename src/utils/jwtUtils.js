// src/utils/jwtUtils.js
const jwt = require('jsonwebtoken');

// Verificar que JWT_SECRET existe
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ ERROR CRÍTICO: JWT_SECRET no está definido en .env');
    process.exit(1); // Detiene el servidor si no hay secreto
}

// Generar token cuando el usuario hace login
function generarToken(usuario) {
    return jwt.sign(
        { 
            id: usuario.id, 
            email: usuario.email,
            nombre: usuario.nombre,
            rol: usuario.rol 
        },
        JWT_SECRET,
        { expiresIn: '7d' } // Token válido por 7 días
    );
}

// Verificar token en cada petición
function verificarToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null; // Token inválido o expirado
    }
}

module.exports = {
    generarToken,
    verificarToken
};