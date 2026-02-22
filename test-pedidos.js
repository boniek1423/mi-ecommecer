// test-pedidos.js
const db = require('./src/config/db');

async function testPedidos() {
    try {
        console.log('🔍 Verificando tabla pedidos...');
        
        // Verificar si la tabla existe
        const [tablas] = await db.query("SHOW TABLES LIKE 'pedidos'");
        if (tablas.length === 0) {
            console.log('❌ La tabla pedidos NO existe');
            console.log('\n📝 Debes crear la tabla con este SQL:');
            console.log(`
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    estado ENUM('pendiente', 'procesando', 'enviado', 'entregado', 'cancelado') DEFAULT 'pendiente',
    direccion_envio TEXT NOT NULL,
    telefono_contacto VARCHAR(20) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
            `);
            return;
        }
        
        console.log('✅ La tabla pedidos existe');
        
        // Verificar estructura
        const [columnas] = await db.query('DESCRIBE pedidos');
        console.log('\n📊 Columnas en pedidos:');
        columnas.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
        });
        
        // Probar consulta
        const [pedidos] = await db.query('SELECT COUNT(*) as total FROM pedidos');
        console.log(`\n📦 Total de pedidos: ${pedidos[0].total}`);
        
        // Verificar si hay datos
        if (pedidos[0].total > 0) {
            const [primerPedido] = await db.query('SELECT * FROM pedidos LIMIT 1');
            console.log('\n📋 Ejemplo de pedido:', primerPedido[0]);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

testPedidos();