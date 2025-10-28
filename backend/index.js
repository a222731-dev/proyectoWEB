const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); 
const path = require('path'); 

const app = express();
app.use(express.json()); // Permite a Express leer cuerpos de peticiones en formato JSON
app.use(cors()); // Habilita CORS para permitir peticiones desde tu frontend (navegador)

// ----------------------------------------------------------------
// CONFIGURACIÓN DE CONEXIÓN A LOS NODOS DE LA BDDD
// Las variables de entorno provienen de docker-compose.yml
// ----------------------------------------------------------------

const DB_USER = process.env.DB_USER || 'user_bddd';
const DB_PASS = process.env.DB_PASS || 'superclave';

// Pool de conexión para el NODO 1 (db_nodo1)
const pool1 = new Pool({
  host: process.env.DB1_HOST || 'db_nodo1', 
  port: 5432,
  database: 'datos_principales',
  user: DB_USER,
  password: DB_PASS,
});

// Pool de conexión para el NODO 2 (db_nodo2)
const pool2 = new Pool({
  host: process.env.DB2_HOST || 'db_nodo2',
  port: 5432,
  database: 'datos_secundarios', 
  user: DB_USER,
  password: DB_PASS,
});

// Función de prueba para verificar que las conexiones están vivas
async function testConnections() {
    try {
        await pool1.query('SELECT 1');
        console.log('✅ Conexión a NODO 1 (datos_principales) exitosa.');
        await pool2.query('SELECT 1');
        console.log('✅ Conexión a NODO 2 (datos_secundarios) exitosa.');
    } catch (err) {
        console.error('❌ Error al conectar a una de las bases de datos:', err.message);
        // Si no puede conectar, el servidor debería cerrarse para evitar errores.
        process.exit(1); 
    }
}

// ----------------------------------------------------------------
// SERVIR ARCHIVOS ESTÁTICOS (FRONTEND)
// ----------------------------------------------------------------

// Le dice a Express que use la carpeta 'frontend' para archivos estáticos (CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, 'frontend')));

// Ruta principal: sirve tu index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ----------------------------------------------------------------
// LÓGICA DE DISTRIBUCIÓN (BACKEND - El núcleo de tu BDDD)
// ----------------------------------------------------------------

/**
 * Endpoint POST /datos
 * Recibe un dato y lo inserta en el nodo de PostgreSQL correspondiente
 */
app.post('/datos', async (req, res) => {
    const { id, nombre, valor } = req.body;
    
    // VALIDACIÓN BÁSICA
    if (!id || !nombre) {
        return res.status(400).send({ error: 'Faltan campos (id y nombre son requeridos).' });
    }

    // Lógica de Particionamiento (Horizontal Sharding)
    // Usamos el 'id' para decidir a qué nodo enviarlo (ejemplo simple: par/impar)
    const isEven = id % 2 === 0;
    const targetPool = isEven ? pool2 : pool1;
    const targetDbName = isEven ? 'NODO 2' : 'NODO 1';

    try {
        const query = 'INSERT INTO items(id, nombre, valor) VALUES($1, $2, $3)';
        await targetPool.query(query, [id, nombre, valor]);
        
        console.log(`Dato ID ${id} insertado en ${targetDbName}`);
        res.status(201).send({ 
            message: `Dato insertado correctamente.`,
            nodo: targetDbName 
        });
    } catch (error) {
        console.error(`Error al insertar el dato en ${targetDbName}:`, error.message);
        res.status(500).send({ error: 'Error al procesar la solicitud de inserción.' });
    }
});


/**
 * Endpoint GET /datos
 * Consulta ambos nodos y combina los resultados (Scatter/Gather)
 */
app.get('/datos', async (req, res) => {
    try {
        // Ejecuta consultas en ambos nodos de forma concurrente
        const [result1, result2] = await Promise.all([
            pool1.query('SELECT * FROM items ORDER BY id ASC'),
            pool2.query('SELECT * FROM items ORDER BY id ASC'),
        ]);

        // Combina los resultados de ambos nodos en un solo array
        const todosLosDatos = [...result1.rows, ...result2.rows];

        // Envía el resultado combinado al frontend
        res.json(todosLosDatos);
    } catch (error) {
        console.error('Error al consultar datos de la BDDD:', error.message);
        res.status(500).send({ error: 'Error al consultar las bases de datos distribuidas.' });
    }
});


// ----------------------------------------------------------------
// INICIALIZACIÓN DEL SERVIDOR
// ----------------------------------------------------------------

const PORT = 8080;

app.listen(PORT, async () => {
    console.log(`🚀 Servidor Backend corriendo en http://localhost:${PORT}`);
    // Opcional: Probar las conexiones antes de aceptar tráfico
    await testConnections();
});