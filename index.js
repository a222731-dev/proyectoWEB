const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); 
const path = require('path'); 

const app = express();
app.use(express.json()); // Necesario para recibir JSON en el POST
app.use(cors());

// --- Configuración de Conexión a Nodos (Sucursales) ---
const DB_USER = process.env.DB_USER || 'user_bddd';
const DB_PASS = process.env.DB_PASS || 'superclave';

// Pool para SUCURSAL 1 (Nodo 1 - Local)
const pool1 = new Pool({
  host: process.env.DB1_HOST || 'db_nodo1', 
  port: 5432,
  database: 'datos_principales',
  user: DB_USER,
  password: DB_PASS,
});

// Pool para SUCURSAL 2 (Nodo 2 - Remota)
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
        // No cerramos el proceso para permitir que intenten reconectar si es un fallo temporal
    }
}

// --- Servir Frontend ---
// Sirve index.html, tienda.html, style.css, script.js y la carpeta /img
app.use(express.static(__dirname)); 

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
        // Consultamos solo el Nodo 1 (Sucursal 1)
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
 * Consulta distribuida paralela.
 */
app.get('/api/inventario', async (req, res) => {
    const query1 = 'SELECT producto_data_id, stock FROM inventario'; // Nodo 1
    const query2 = 'SELECT producto_data_id, stock FROM inventario'; // Nodo 2

    try {
        // Ejecutamos consultas en paralelo a ambos nodos
        const [inventarioSuc1, inventarioSuc2] = await Promise.all([
            pool1.query(query1), // Stock en Nodo 1
            pool2.query(query2)  // Stock en Nodo 2
        ]);

        const inventarioCombinado = {};

        // Procesar stock de Sucursal 1
        for (const item of inventarioSuc1.rows) {
            inventarioCombinado[item.producto_data_id] = {
                sucursal_1: item.stock,
                sucursal_2: 0 
            };
        }

        // Procesar y combinar stock de Sucursal 2
        for (const item of inventarioSuc2.rows) {
            if (inventarioCombinado[item.producto_data_id]) {
                inventarioCombinado[item.producto_data_id].sucursal_2 = item.stock;
            } else {
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

/**
 * Endpoint POST /api/compra (NUEVO)
 * Procesa la compra y descuenta el stock de la sucursal correspondiente.
 * Recibe JSON: { sucursal: 1 | 2, items: [ {id, qty}, ... ] }
 */
app.post('/api/compra', async (req, res) => {
    const { sucursal, items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, error: "No hay items en la compra" });
    }

    // 1. Decidir qué base de datos usar (Sucursal 1 o Sucursal 2)
    // Si la sucursal es 2, usamos pool2. Si no, por defecto pool1.
    const targetPool = (sucursal === 2) ? pool2 : pool1;
    const nombreSucursal = (sucursal === 2) ? "Sucursal 2 (Remota)" : "Sucursal 1 (Local)";

    console.log(`📦 Procesando compra en ${nombreSucursal}...`);

    try {
        // 2. Iterar sobre los productos y restar stock
        // Usamos un bucle simple para actualizar cada producto
        for (const item of items) {
            const query = 'UPDATE inventario SET stock = stock - $1 WHERE producto_data_id = $2';
            
            // Ejecutamos la query en el nodo seleccionado
            await targetPool.query(query, [item.qty, item.id]);
        }

        console.log(`✅ Compra exitosa en ${nombreSucursal}. Stock actualizado.`);
        res.json({ success: true, message: `Compra procesada correctamente en ${nombreSucursal}.` });

    } catch (error) {
        console.error("❌ Error al procesar compra en BDDD:", error.message);
        res.status(500).json({ success: false, error: "Error al actualizar la base de datos." });
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