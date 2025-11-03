// --------- VARIABLES GLOBALES -----------
// Mapas para la lógica del carrito
const productQuantities = new Map();
const addedQuantities = new Map();

// Selectores de UI principales
const cartCountEl = document.querySelector('.cart-count');
const productGridEl = document.querySelector('.grid');
const categoryButtons = document.querySelectorAll('.btn-cat'); // Botones de filtro

// Almacenes de datos (Caché local de BDDD)
let allProductsData = [];
let allInventoryData = {};

// --- NUEVO: Variables de Admin ---
let isAdminLoggedIn = false;
const ADMIN_PASSWORD = 'admin'; // Contraseña simple para la demo
// Selectores del panel de Admin
const adminLoginForm = document.querySelector('#admin-login-form');
const adminPassInput = document.querySelector('#admin-pass');
const adminStatus = document.querySelector('#admin-status');
const adminLogoutBtn = document.querySelector('#admin-logout-btn');
const adminError = document.querySelector('#admin-error-msg');


// --------- INICIALIZACIÓN -----------
// Espera a que el HTML esté cargado para empezar
document.addEventListener('DOMContentLoaded', main);

/**
 * Función principal - Carga los datos de la BDDD y configura la página.
 */
async function main() {
    console.log("🚀 Página cargada. Conectando a la BDDD...");
    try {
        // 1. Cargar Catálogo (Nodo 1) e Inventario (Ambos Nodos) al mismo tiempo
        const [productos, inventario] = await Promise.all([
            fetch('/api/productos').then(res => res.json()),
            fetch('/api/inventario').then(res => res.json())
        ]);

        if (!productos || !inventario) {
            throw new Error("No se pudieron cargar los datos de la BDDD.");
        }

        // 2. Guardar los datos en las variables globales
        allProductsData = productos;
        allInventoryData = inventario;
        
        // 3. Dibujar los productos en el HTML y activar los botones
        renderProductos(allProductsData); // Dibuja todos los productos
        setupEventListeners(); // Activa todos los botones (filtros, carrito, admin)

        console.log("✅ BDDD conectada y productos renderizados.");
        console.log("Inventario Distribuido Cargado:", allInventoryData);

    } catch (error) {
        console.error("❌ FALLA CRÍTICA:", error.message);
        productGridEl.innerHTML = `<p>Error al conectar con el servidor. ${error.message}</p>`;
    }
}

// --------- RENDERIZADO DE PRODUCTOS (HTML DINÁMICO) -----------

/**
 * Dibuja las tarjetas de producto en el DOM.
 * @param {Array} productos - La lista de productos a dibujar.
 */
function renderProductos(productos) {
    productGridEl.innerHTML = ''; // Limpia el grid antes de dibujar

    if (productos.length === 0) {
        productGridEl.innerHTML = '<p>No se encontraron productos para esta categoría.</p>';
        return;
    }

    // Por cada producto en los datos, crea una tarjeta HTML
    for (const producto of productos) {
        // Obtiene el stock de ambas sucursales desde los datos de inventario
        const stockInfo = allInventoryData[producto.data_product_id] || { sucursal_1: 0, sucursal_2: 0 };
        productQuantities.set(producto.data_product_id, 1); // Inicia el contador de cantidad

        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.category = producto.data_category;
        card.dataset.productId = producto.data_product_id;

        // Clases de CSS para "agotado"
        const stock1Agotado = stockInfo.sucursal_1 === 0 ? 'agotado' : '';
        const stock2Agotado = stockInfo.sucursal_2 === 0 ? 'agotado' : '';
        
        // Convierte el precio (texto) a número y lo formatea
        const precioFormateado = parseFloat(producto.precio).toFixed(2);

        // Genera el HTML de la tarjeta
        // Nota: El botón .btn-search-suc2 y .stock-sucursal-2 SIEMPRE se crean.
        // El CSS (style.css) se encarga de OCULTARLOS si no eres admin.
        card.innerHTML = `
            <img src="${producto.ruta_imagen}" alt="${producto.nombre}">
            <h3>${producto.nombre}</h3>
            <p class="desc">${producto.descripcion}</p>
            
            <div class="stock-info">
                <!-- Stock Sucursal 1 (Centrado) -->
                <span class="stock-sucursal stock-sucursal-1 ${stock1Agotado}">
                    ${stockInfo.sucursal_1}
                </span>
                
                <!-- Botón de búsqueda BDDD (Oculto por defecto por CSS) -->
                <button class="btn btn-secondary btn-search-suc2" title="Consultar Sucursal 2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                    </svg>

                </button>

                <!-- Stock Sucursal 2 (Oculto por defecto por CSS y JS) -->
                <span class="stock-sucursal ${stock2Agotado} stock-sucursal-2 hidden">
                    Sucursal 2: ${stockInfo.sucursal_2}
                </span>
            </div>
            
            <div class="card-footer">
                <span class="price">$${precioFormateado}</span>
                <div class="quantity-selector" data-product-id="${producto.data_product_id}">
                    <button class="btn btn-secondary quantity-btn minus-btn" disabled>-</button>
                    <span class="quantity-display">1</span>
                    <button class="btn btn-secondary quantity-btn plus-btn">+</button>
                </div>
                <button class="btn btn-primary add-to-cart-btn">Agregar</button>
            </div>
        `;
        
        productGridEl.appendChild(card);
    }
}

// --------- LÓGICA DE EVENTOS (FILTROS, CARRITO Y ADMIN) -----------

function setupEventListeners() {
    
    // 1. Lógica de Filtros (Categorías)
    categoryButtons.forEach(btn => {
        const filterValue = btn.dataset.filter || btn.textContent;
        btn.addEventListener('click', () => {
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterProducts(filterValue);
        });
    });
    
    // 2. Lógica de Clics en el Grid (Event Delegation)
    // Escucha clics en el contenedor padre 'grid'
    productGridEl.addEventListener('click', (event) => {
        const target = event.target;
        const card = target.closest('.card');
        if (!card) return; // Si el clic no fue dentro de una tarjeta, ignora

        const productId = card.dataset.productId;

        // Identifica qué botón se presionó
        if (target.classList.contains('minus-btn')) {
            handleQuantityChange(productId, -1);
        } else if (target.classList.contains('plus-btn')) {
            handleQuantityChange(productId, 1);
        } else if (target.classList.contains('add-to-cart-btn')) {
            handleToggleCart(productId, target);
        } else if (target.closest('.btn-search-suc2')) {
            // Si se hizo clic en el botón de búsqueda (o su icono)
            handleSearchSuc2(productId);
        }
    });

    // --- NUEVO: Listeners de Admin ---
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', handleAdminLogout);
    }
}

// --------- NUEVAS FUNCIONES DE ADMIN -----------

/**
 * Maneja el evento de submit del formulario de login.
 */
function handleAdminLogin(event) {
    event.preventDefault(); // Evita que el formulario recargue la página
    const pass = adminPassInput.value;
    
    if (pass === ADMIN_PASSWORD) {
        // --- ÉXITO ---
        console.log("Login de Admin exitoso.");
        isAdminLoggedIn = true;
        
        // Actualiza la UI del panel de login
        adminLoginForm.classList.add('hidden');
        adminStatus.classList.remove('hidden');
        adminError.classList.add('hidden');
        
        // ¡Añade la clase 'admin-view' al grid!
        // El CSS (style.css) usará esto para mostrar los botones de búsqueda.
        productGridEl.classList.add('admin-view');
        
    } else {
        // --- FALLO ---
        console.warn("Intento de login fallido.");
        isAdminLoggedIn = false;
        adminError.textContent = 'Contraseña incorrecta.';
        adminError.classList.remove('hidden');
    }
    adminPassInput.value = ''; // Limpia el campo
}

/**
 * Maneja el clic en el botón de logout.
 */
function handleAdminLogout() {
    console.log("Admin cerró sesión.");
    isAdminLoggedIn = false;
    
    // Resetea la UI del panel
    adminLoginForm.classList.remove('hidden');
    adminStatus.classList.add('hidden');
    adminError.classList.add('hidden');
    
    // ¡Quita la clase 'admin-view' del grid!
    // El CSS ocultará los botones de búsqueda de BDDD.
    productGridEl.classList.remove('admin-view');
    
    // Oculta cualquier stock 2 que haya quedado abierto
    document.querySelectorAll('.stock-sucursal-2').forEach(span => {
        span.classList.add('hidden');
    });
}


// --------- FUNCIONES DE LA APLICACIÓN (CARRITO, FILTRO, BDDD) -----------

/**
 * Muestra/Oculta el stock de la Sucursal 2 (función BDDD).
 */
function handleSearchSuc2(productId) {
    const card = productGridEl.querySelector(`[data-product-id="${productId}"]`);
    if (!card) return;

    const stock2Span = card.querySelector('.stock-sucursal-2');
    if (stock2Span) {
        // .toggle() es un interruptor: añade 'hidden' si no está, la quita si sí está.
        stock2Span.classList.toggle('hidden');
    }
}

/**
 * Filtra los productos renderizados por categoría.
 */
function filterProducts(filter) {
    let productosFiltrados;
    // Si el filtro es 'Todos' o 'TOP', muestra todos los productos
    if (filter === 'Todos' || filter === 'TOP') {
        productosFiltrados = allProductsData;
    } else {
        // Si no, filtra la lista por 'data_category'
        productosFiltrados = allProductsData.filter(
            producto => producto.data_category === filter
        );
    }
    // Vuelve a dibujar el grid solo con los productos filtrados
    renderProductos(productosFiltrados);
}

/**
 * Maneja los botones de + y - cantidad.
 */
function handleQuantityChange(productId, change) {
    // Obtiene la cantidad actual del mapa
    let currentQuantity = productQuantities.get(productId);
    currentQuantity += change;
    if (currentQuantity < 1) currentQuantity = 1; // No permite bajar de 1
    
    // Actualiza el mapa
    productQuantities.set(productId, currentQuantity);
    
    // Actualiza la UI de la tarjeta
    const card = productGridEl.querySelector(`[data-product-id="${productId}"]`);
    if (card) {
        const display = card.querySelector('.quantity-display');
        const minusBtn = card.querySelector('.minus-btn');
        display.textContent = currentQuantity;
        minusBtn.disabled = currentQuantity <= 1; // Deshabilita '-' si es 1
    }
}

/**
 * Maneja el clic en "Agregar" / "Quitar" del carrito.
 */
function handleToggleCart(productId, addBtn) {
    let currentCartTotal = Number(cartCountEl.textContent);
    const card = addBtn.closest('.card');
    const minusBtn = card.querySelector('.minus-btn');
    const plusBtn = card.querySelector('.plus-btn');

    if (!addedQuantities.has(productId)) {
        // --- AGREGAR ---
        const quantityToAdd = productQuantities.get(productId);
        cartCountEl.textContent = currentCartTotal + quantityToAdd;
        addedQuantities.set(productId, quantityToAdd);
        
        // Cambia el botón a modo "Quitar"
        addBtn.textContent = `Quitar (${quantityToAdd}x)`;
        addBtn.classList.add('remove-state');
        // Bloquea los selectores de cantidad
        minusBtn.disabled = true;
        plusBtn.disabled = true;

    } else {
        // --- QUITAR ---
        const quantityToRemove = addedQuantities.get(productId);
        cartCountEl.textContent = currentCartTotal - quantityToRemove;
        addedQuantities.delete(productId);
        
        // Resetea el botón a modo "Agregar"
        addBtn.textContent = 'Agregar';
        addBtn.classList.remove('remove-state');
        // Desbloquea los selectores
        plusBtn.disabled = false;
        
        // Resetea la cantidad a 1
        productQuantities.set(productId, 1);
        const display = card.querySelector('.quantity-display');
        display.textContent = 1;
        minusBtn.disabled = true; // Deshabilita '-' porque la cantidad es 1
    }
}