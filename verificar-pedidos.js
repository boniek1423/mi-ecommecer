// verificar-pedidos.js
const db = require('./src/config/db');

async function verificarPedidos() {
    try {
        console.log('🔍 Verificando estructura de la tabla pedidos...\n');
        
        // Ver columnas de la tabla
        const [columnas] = await db.query('DESCRIBE pedidos');
        console.log('📊 Columnas en tabla pedidos:');
        columnas.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
        });
        
        // Ver si hay algún campo de fecha
        console.log('\n📅 Posibles columnas de fecha:');
        const fechas = columnas.filter(col => 
            col.Field.includes('date') || 
            col.Field.includes('time') || 
            col.Field.includes('fecha') ||
            col.Field.includes('created') ||
            col.Field.includes('registro')
        );
        
        if (fechas.length > 0) {
            fechas.forEach(col => {
                console.log(`   ✅ ${col.Field} - disponible`);
            });
        } else {
            console.log('   ❌ No se encontró ninguna columna de fecha');
            console.log('\n📝 Debes agregar una columna de fecha con:');
            console.log('   ALTER TABLE pedidos ADD COLUMN fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

verificarPedidos();