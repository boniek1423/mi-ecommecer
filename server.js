const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// IMPORTANTE: El webhook de Stripe necesita el body raw
// Debe ir ANTES de express.json()
app.post('/api/pagos/webhook', 
    express.raw({ type: 'application/json' }),
    (req, res) => {
        // Temporalmente mientras implementamos Stripe
        console.log('Webhook recibido');
        res.json({ received: true });
    }
);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Importar rutas
const authRoutes = require('./src/routes/authRoutes');
const productoRoutes = require('./src/routes/productoRoutes');
const carritoRoutes = require('./src/routes/carritoRoutes');
const pedidoRoutes = require('./src/routes/pedidoRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const categoriaRoutes = require('./src/routes/categoriaRoutes');
// const pagoRoutes = require('./src/routes/pagoRoutes'); // Descomentar cuando tengamos Stripe

// Verificación de tipos
console.log('✅ Rutas cargadas correctamente:');
console.log('   - authRoutes:', typeof authRoutes === 'function' ? 'OK' : 'ERROR');
console.log('   - productoRoutes:', typeof productoRoutes === 'function' ? 'OK' : 'ERROR');
console.log('   - carritoRoutes:', typeof carritoRoutes === 'function' ? 'OK' : 'ERROR');
console.log('   - pedidoRoutes:', typeof pedidoRoutes === 'function' ? 'OK' : 'ERROR');
console.log('   - usuarioRoutes:', typeof usuarioRoutes === 'function' ? 'OK' : 'ERROR');
console.log('   - categoriaRoutes:', typeof categoriaRoutes === 'function' ? 'OK' : 'ERROR');

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/categorias', categoriaRoutes);
// app.use('/api/pagos', pagoRoutes); // Descomentar cuando tengamos Stripe

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: '¡Bienvenido a mi e-commerce con Node.js!',
        endpoints: {
            auth: '/api/auth',
            productos: '/api/productos',
            carrito: '/api/carrito',
            pedidos: '/api/pedidos',
            usuarios: '/api/usuarios',
            categorias: '/api/categorias'
        }
    });
});

// Manejo de rutas no encontradas - CORREGIDO: usar (.*) en lugar de *
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.path}`
    });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error global:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📝 Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Prueba la API en http://localhost:${PORT}\n`);
});