const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
require('dotenv').config();

// Configuración de la base de datos (usa tus mismos datos del .env)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_personal',
    waitForConnections: true
}).promise();

async function crearAdmin() {
    try {
        // 1. Primero, eliminar el admin anterior si existe
        await pool.query('DELETE FROM usuarios WHERE email = ?', ['admin@tienda.com']);
        console.log('✅ Usuario anterior eliminado');

        // 2. Generar el hash de la contraseña
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        
        console.log('🔑 Contraseña:', password);
        console.log('🔒 Hash generado:', hash);

        // 3. Insertar el nuevo administrador
        const [result] = await pool.query(
            `INSERT INTO usuarios (nombre, email, password, rol, fecha_registro) 
             VALUES (?, ?, ?, ?, NOW())`,
            ['Administrador', 'admin@tienda.com', hash, 'admin']
        );

        console.log('✅ Administrador creado exitosamente!');
        console.log('📧 Email: admin@tienda.com');
        console.log('🔑 Contraseña: admin123');
        
        // 4. Verificar que se insertó correctamente
        const [usuarios] = await pool.query(
            'SELECT id, nombre, email, rol FROM usuarios WHERE email = ?',
            ['admin@tienda.com']
        );
        
        if (usuarios.length > 0) {
            console.log('\n✅ Verificación:');
            console.log('   ID:', usuarios[0].id);
            console.log('   Nombre:', usuarios[0].nombre);
            console.log('   Email:', usuarios[0].email);
            console.log('   Rol:', usuarios[0].rol);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
}

crearAdmin();