const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); 
const path = require('path'); 

const app = express();
app.use(express.json());
app.use(cors());

// --- Configuración de Conexión a Nodos (Sucursales) ---
const DB_USER = process.env.DB_USER || 'user_bddd';
const DB_PASS = process.env.DB_PASS || 'superclave';

// Pool para SUCURSAL 1 (Nodo 1)
const pool1 = new Pool({
  host: process.env.DB1_HOST || 'db_nodo1', 
  port: 5432,
  database: 'datos_principales',
  user: DB_USER,
  password: DB_PASS,
});

// Pool para SUCURSAL 2 (Nodo 2)
const pool2 = new Pool({
  host: process.env.DB2_HOST || 'db_nodo2',
  port: 5432,
  database: 'datos_secundarios', 
  user: DB_USER,
  password: DB_PASS,
});

// Función de prueba de conexión
async function testConnections() {
    try {
        await pool1.query('SELECT 1');
        console.log('✅ Conexión a SUCURSAL 1 (datos_principales) exitosa.');
        await pool2.query('SELECT 1');
        console.log('✅ Conexión a SUCURSAL 2 (datos_secundarios) exitosa.');
    } catch (err) {
        console.error('❌ Error al conectar a una de las sucursales:', err.message);
        process.exit(1); 
    }
}

// --- Servir Frontend ---
app.use(express.static(__dirname)); // Sirve index.html, style.css, script.js y /img

// ----------------------------------------------------------------
// ENDPOINTS DE LA API (El núcleo de la BDDD)
// ----------------------------------------------------------------

/**
 * Endpoint GET /api/productos
 * Obtiene el catálogo de productos.
 * Como los productos (catálogo) están REPLICADOS, solo consultamos 1 nodo.
 */
app.get('/api/productos', async (req, res) => {
    try {
        // Consultamos solo el Nodo 1 (Sucursal 1) porque los productos son idénticos
        const result = await pool1.query('SELECT * FROM productos ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al consultar productos:', error.message);
        res.status(500).send({ error: 'Error al consultar el catálogo.' });
    }
});

/**
 * Endpoint GET /api/inventario
 * Obtiene el stock de TODOS los productos en AMBAS sucursales.
 * ¡Esta es la consulta distribuida clave!
 */
app.get('/api/inventario', async (req, res) => {
    // Consultas para obtener el inventario de ambas sucursales
    const query1 = 'SELECT producto_data_id, stock FROM inventario'; // Nodo 1
    const query2 = 'SELECT producto_data_id, stock FROM inventario'; // Nodo 2

    try {
        // Ejecutamos consultas en paralelo a ambos nodos
        const [inventarioSuc1, inventarioSuc2] = await Promise.all([
            pool1.query(query1), // Stock en Nodo 1
            pool2.query(query2)  // Stock en Nodo 2
        ]);

        // Combinamos los resultados en un objeto fácil de usar para el frontend
        // La clave será el 'prod-1', 'prod-2', etc.
        const inventarioCombinado = {};

        // Procesar stock de Sucursal 1
        for (const item of inventarioSuc1.rows) {
            inventarioCombinado[item.producto_data_id] = {
                sucursal_1: item.stock,
                sucursal_2: 0 // Valor por defecto
            };
        }

        // Procesar y combinar stock de Sucursal 2
        for (const item of inventarioSuc2.rows) {
            if (inventarioCombinado[item.producto_data_id]) {
                // Si ya existe la entrada (del Nodo 1), añade el stock del Nodo 2
                inventarioCombinado[item.producto_data_id].sucursal_2 = item.stock;
            } else {
                // Si por alguna razón el producto solo existe en Nodo 2
                inventarioCombinado[item.producto_data_id] = {
                    sucursal_1: 0,
                    sucursal_2: item.stock
                };
            }
        }
        
        res.json(inventarioCombinado);

    } catch (error) {
        console.error('Error en consulta distribuida de inventario:', error.message);
        res.status(500).send({ error: 'Error al consultar inventario.' });
    }
});

// ----------------------------------------------------------------
// INICIALIZACIÓN DEL SERVIDOR
// ----------------------------------------------------------------
const PORT = 8080;
app.listen(PORT, async () => {
    console.log(`🚀 Servidor (Sede Central) corriendo en http://localhost:${PORT}`);
    await testConnections();
});