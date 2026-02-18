const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const authMiddleware = require('../middlewares/authMiddleware');

// IMPORTANTE: Para webhooks necesitamos el body raw
router.post('/webhook', 
    express.raw({ type: 'application/json' }), 
    pagoController.webhook
);

// Rutas protegidas
router.post('/crear-sesion', 
    authMiddleware, 
    pagoController.crearSesionPago
);

router.get('/verificar/:sessionId', 
    authMiddleware, 
    pagoController.verificarPago
);

module.exports = router;