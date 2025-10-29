// El mapa almacenará la cantidad SELECCIONADA en el selector de cada producto.
const productQuantities = new Map();

// El mapa almacenará la cantidad ACTUALMENTE AÑADIDA al carrito para saber cuánto quitar.
const addedQuantities = new Map();

const cartCountEl = document.querySelector('.cart-count');

// --- Lógica de Manejo de Cantidad (+ / -) y Agregar/Quitar al Carrito ---
document.querySelectorAll('.quantity-selector').forEach(selector => {
  const productId = selector.dataset.productId;
  const minusBtn = selector.querySelector('.minus-btn');
  const plusBtn = selector.querySelector('.plus-btn');
  const display = selector.querySelector('.quantity-display');
  // Busca el botón "Agregar" asociado a este selector
  const addBtn = selector.closest('.card-footer').querySelector('.add-to-cart-btn');

  // Inicializar cantidad a 1 para cada producto
  productQuantities.set(productId, 1);

  // Función para actualizar la vista del selector y el estado del botón '-'
  const updateDisplay = (quantity) => {
    display.textContent = quantity;
    // Deshabilita '-' si la cantidad es 1
    minusBtn.disabled = quantity <= 1; 
  };

  // Lógica para decrementar la cantidad
  minusBtn.addEventListener('click', () => {
    let currentQuantity = productQuantities.get(productId);
    if (currentQuantity > 1) {
      currentQuantity--;
      productQuantities.set(productId, currentQuantity);
      updateDisplay(currentQuantity);
    }
  });

  // Lógica para incrementar la cantidad
  plusBtn.addEventListener('click', () => {
    let currentQuantity = productQuantities.get(productId);
    currentQuantity++;
    productQuantities.set(productId, currentQuantity);
    updateDisplay(currentQuantity);
  });

  // Lógica de Agregar/Quitar (TOGGLE)
  addBtn.addEventListener('click', () => {
    let currentCartTotal = Number(cartCountEl.textContent);

    if (!addedQuantities.has(productId)) {
      // --- ESTADO: AGREGAR EL PRODUCTO (Primer clic) ---
      
      const quantityToAdd = productQuantities.get(productId);

      // 1. Actualiza el contador global del carrito (SUMA)
      cartCountEl.textContent = currentCartTotal + quantityToAdd;
      
      // 2. Almacena la cantidad agregada para poder quitarla después
      addedQuantities.set(productId, quantityToAdd);
      
      // 3. Cambia el texto del botón y lo pone en estado "Quitar"
      addBtn.textContent = `Quitar (${quantityToAdd}x)`;
      addBtn.classList.add('remove-state'); // Opcional: para darle un estilo diferente si quieres
      
      // 4. Deshabilita los botones de cantidad para evitar cambios en el carrito
      minusBtn.disabled = true; 
      plusBtn.disabled = true;
      
    } else {
      // --- ESTADO: QUITAR EL PRODUCTO (Segundo clic) ---
      
      const quantityToRemove = addedQuantities.get(productId);
      
      // 1. Actualiza el contador global del carrito (RESTA)
      cartCountEl.textContent = currentCartTotal - quantityToRemove;

      // 2. Elimina la entrada del mapa de productos agregados
      addedQuantities.delete(productId);
      
      // 3. Cambia el texto del botón de vuelta a "Agregar"
      addBtn.textContent = 'Agregar';
      addBtn.classList.remove('remove-state');

      // 4. Habilita los botones de cantidad
      plusBtn.disabled = false;
      
      // 5. Reinicia la cantidad seleccionada a 1 (buena UX)
      productQuantities.set(productId, 1);
      updateDisplay(1); 
      // La función updateDisplay se encarga de deshabilitar el minusBtn correctamente
    }
  });
  
  // Llamada inicial para establecer el estado de inicio
  updateDisplay(productQuantities.get(productId));
});

// --- Botones de categoría (Lógica original) ---
// 1. Obtener todos los artículos de producto. 
const productArticles = document.querySelectorAll('.card');
const categoryButtons = document.querySelectorAll('.btn-cat');

// Función que filtra los artículos de producto.
const filterProducts = (filter) => {
  productArticles.forEach(article => {
    // Obtiene la categoría del artículo. Mantiene MAYÚSCULAS/MINÚSCULAS tal cual.
    const productCategory = article.dataset.category; 

    // Comparación directa (sensible a mayúsculas/minúsculas)
    if (filter === 'Todos' || productCategory === filter) {
      // Muestra si el filtro es 'Todos' O si la categoría COINCIDE EXACTAMENTE.
      article.style.display = ''; // Muestra el artículo
    } else if (filter === 'TOP') {
        // Para el botón 'TOP', lo más simple es que por ahora muestre todos 
        // al cargar, ya que es el botón 'activo' inicial en tu HTML.
        article.style.display = '';
    } else {
      article.style.display = 'none'; // Oculta el artículo
    }
  });
};

// 2. Lógica de Eventos para los Botones de Categoría (¡La que hace que funcione!)
categoryButtons.forEach(btn => {
  // Obtenemos el valor del filtro directamente del atributo data-filter (ej: "Resistencias")
  // Si no tiene data-filter, usa el texto del botón (ej: "Resistencias")
  const filterValue = btn.dataset.filter || btn.textContent; 

  btn.addEventListener('click', () => {
    // 1. Manejo del estado visual (clase 'active')
    categoryButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 2. Ejecutar el filtro
    filterProducts(filterValue); 
  });
});

// 3. Llamada inicial al cargar la página.
// Muestra el filtro 'TOP' al inicio (que definimos arriba para mostrar todos).
filterProducts('TOP');

// ------------------------------------------------------------------
// INICIO DE CÓDIGO DE PRUEBA DE BDDD (Agregado)
// ------------------------------------------------------------------

// Espera a que todo el contenido de la página (HTML) esté cargado
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Página cargada. Iniciando prueba de BDDD...");
    
    // Ejecutamos la prueba de distribución
    probarBDDD();
});

const URL_BACKEND = 'http://localhost:8080/datos';

/**
 * Función principal para probar la BDDD
 */
async function probarBDDD() {
    try {
        // --- 1. PRUEBA DE INSERCIÓN (Sharding) ---
        console.log("Insertando datos... (Lógica Par/Impar)");

        // ID Impar (debería ir al Nodo 1)
        await insertarDato(101, 'Mouse Gamer', 50.99);
        
        // ID Par (debería ir al Nodo 2)
        await insertarDato(102, 'Monitor Ultrawide', 450.00);

        // --- 2. PRUEBA DE CONSULTA (Scatter/Gather) ---
        console.log("Consultando todos los nodos...");
        const response = await fetch(URL_BACKEND);
        
        if (!response.ok) {
            // Si la respuesta no es 200 OK, maneja el error
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error desconocido del servidor');
        }
        
        const datos = await response.json();

        console.log("✅ ¡PRUEBA EXITOSA! Se obtuvieron datos de ambos nodos.");
        console.log(`Total de registros combinados: ${datos.length}`);
        console.table(datos); // Muestra los datos en una tabla bonita

    } catch (error) {
        console.error("❌ FALLA CRÍTICA: No se pudo conectar o procesar la BDDD.", error.message);
    }
}


/**
 * Función auxiliar para insertar un dato (POST)
 */
async function insertarDato(id, nombre, valor) {
    try {
        const response = await fetch(URL_BACKEND, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, valor })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log(`-> ID ${id} insertado. Nodo reportado: ${data.nodo}`);
        } else {
            // Si el ID ya existe (error de Llave Primaria), lo marcamos como advertencia
            if (data.error && (data.error.includes('duplicate key') || data.error.includes('llave duplicada'))) {
                console.warn(`-> ID ${id} ya existía. (Esto es normal si recargas la página)`);
            } else {
                console.error(`-> Error al insertar ID ${id}:`, data.error);
            }
        }
    } catch (error) {
        console.error(`Error de conexión al insertar ID ${id}:`, error);
    }
}