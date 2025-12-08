// --------- VARIABLES GLOBALES -----------
const productQuantities = new Map();
const addedQuantities = new Map(); // Aquí guardamos lo que está en el carrito { id -> cantidad }

// Selectores de UI
const cartCountEl = document.querySelector('.cart-count');
const productGridEl = document.querySelector('.grid');
const categoryButtons = document.querySelectorAll('.btn-cat');
const cartBtn = document.querySelector('.cart-btn'); // Botón del carrito (arriba derecha)

// Selectores del Modal (Carrito)
const cartModal = document.getElementById('cart-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartTotalDisplay = document.getElementById('cart-total-display');
const checkoutBtn = document.getElementById('checkout-btn');
const modalBranchInfo = document.getElementById('modal-branch-info');

// Selectores de Búsqueda
const searchInput = document.querySelector('input[type="search"]');
const searchBtn = document.querySelector('.search-btn');

// Almacenes de datos
let allProductsData = [];
let allInventoryData = {};

// Estados
let currentCategoryFilter = 'Todos';
let currentSearchTerm = ''; 
let isAdminLoggedIn = false; // Define si compramos en Sucursal 1 o 2

const ADMIN_PASSWORD = 'admin'; 
const adminLoginForm = document.querySelector('#admin-login-form');
const adminPassInput = document.querySelector('#admin-pass');
const adminStatus = document.querySelector('#admin-status');
const adminLogoutBtn = document.querySelector('#admin-logout-btn');
const adminError = document.querySelector('#admin-error-msg');


// --------- INICIALIZACIÓN -----------
document.addEventListener('DOMContentLoaded', main);

async function main() {
    console.log("🚀 Iniciando tienda...");
    await loadData();
    setupEventListeners();
}

async function loadData() {
    try {
        const [productos, inventario] = await Promise.all([
            fetch('/api/productos').then(res => res.json()),
            fetch('/api/inventario').then(res => res.json())
        ]);
        allProductsData = productos;
        allInventoryData = inventario;
        renderProductos(allProductsData);
        console.log("✅ Datos actualizados.");
    } catch (error) {
        console.error("Error cargando datos:", error);
        productGridEl.innerHTML = `<p>Error de conexión.</p>`;
    }
}

// --------- RENDERIZADO -----------
function getStockSeguro(producto) {
    const id = producto.data_product_id;
    const info = allInventoryData[id] || { sucursal_1: 0, sucursal_2: 0 };
    return { 
        sucursal_1: parseInt(info.sucursal_1) || 0, 
        sucursal_2: parseInt(info.sucursal_2) || 0
    };
}

function renderProductos(productos) {
    productGridEl.innerHTML = ''; 
    if (productos.length === 0) {
        productGridEl.innerHTML = '<p>No hay productos.</p>';
        return;
    }

    for (const producto of productos) {
        const stockInfo = getStockSeguro(producto);
        if (!productQuantities.has(producto.data_product_id)) productQuantities.set(producto.data_product_id, 1);

        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.productId = producto.data_product_id;

        const stock1Class = stockInfo.sucursal_1 === 0 ? 'agotado' : '';
        const stock2Class = stockInfo.sucursal_2 === 0 ? 'agotado' : '';
        
        card.innerHTML = `
            <img src="${producto.ruta_imagen}" alt="${producto.nombre}">
            <h3>${producto.nombre}</h3>
            <p class="desc">${producto.descripcion}</p>
            <div class="stock-info">
                <span class="stock-sucursal stock-sucursal-1 ${stock1Class}">${stockInfo.sucursal_1}</span>
                <button class="btn btn-secondary btn-search-suc2" title="Ver Sucursal 2">🔍</button>
                <span class="stock-sucursal ${stock2Class} stock-sucursal-2 hidden">Suc 2: ${stockInfo.sucursal_2}</span>
            </div>
            <div class="card-footer">
                <span class="price">$${parseFloat(producto.precio).toFixed(2)}</span>
                <div class="quantity-selector">
                    <button class="btn btn-secondary quantity-btn minus-btn" ${productQuantities.get(producto.data_product_id) <= 1 ? 'disabled' : ''}>-</button>
                    <span class="quantity-display">${productQuantities.get(producto.data_product_id)}</span>
                    <button class="btn btn-secondary quantity-btn plus-btn">+</button>
                </div>
                <button class="btn btn-primary add-to-cart-btn">Agregar</button>
            </div>
        `;
        
        if (addedQuantities.has(producto.data_product_id)) {
            const addBtn = card.querySelector('.add-to-cart-btn');
            addBtn.textContent = `En carrito (${addedQuantities.get(producto.data_product_id)})`;
            addBtn.classList.add('remove-state');
        }
        productGridEl.appendChild(card);
    }
}

// --------- EVENTOS -----------
function setupEventListeners() {
    // Filtros
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategoryFilter = btn.dataset.filter || btn.textContent;
            applyFilters();
        });
    });

    const stockCheckbox = document.querySelector('.checkbox input');
    if (stockCheckbox) stockCheckbox.addEventListener('change', applyFilters);

    // Búsqueda
    if (searchInput) {
        searchInput.addEventListener('search', () => { currentSearchTerm = searchInput.value.trim().toLowerCase(); applyFilters(); });
        searchInput.addEventListener('input', () => { if(searchInput.value === '') { currentSearchTerm = ''; applyFilters(); }});
    }
    if (searchBtn) searchBtn.addEventListener('click', () => { currentSearchTerm = searchInput.value.trim().toLowerCase(); applyFilters(); });

    // Limpiar
    document.querySelector('.btn-ghost')?.addEventListener('click', () => {
        currentCategoryFilter = 'Todos'; currentSearchTerm = ''; 
        if(stockCheckbox) stockCheckbox.checked = false;
        if(searchInput) searchInput.value = '';
        categoryButtons.forEach(b => b.classList.remove('active'));
        applyFilters();
    });

    // Grid Interacción
    productGridEl.addEventListener('click', (e) => {
        const target = e.target;
        const card = target.closest('.card');
        if (!card) return; 
        const id = card.dataset.productId;

        if (target.classList.contains('minus-btn')) handleQty(id, -1);
        else if (target.classList.contains('plus-btn')) handleQty(id, 1);
        else if (target.classList.contains('add-to-cart-btn')) handleToggleCart(id, target);
        else if (target.closest('.btn-search-suc2')) {
            card.querySelector('.stock-sucursal-2').classList.toggle('hidden');
        }
    });

    // --- CARRITO (MODAL) ---
    cartBtn.addEventListener('click', openCartModal);
    closeModalBtn.addEventListener('click', () => cartModal.classList.add('hidden'));
    checkoutBtn.addEventListener('click', handleCheckout);

    // Admin
    adminLoginForm?.addEventListener('submit', handleAdminLogin);
    adminLogoutBtn?.addEventListener('click', handleAdminLogout);
}

// --------- LÓGICA DEL CARRITO -----------

function openCartModal() {
    cartModal.classList.remove('hidden');
    
    // 1. Mostrar en qué sucursal estamos comprando
    if (isAdminLoggedIn) {
        modalBranchInfo.textContent = "🛒 Comprando en: SUCURSAL 2 (Remota)";
        modalBranchInfo.style.backgroundColor = "#e0f7fa"; // Azulito para diferenciar
        modalBranchInfo.style.color = "#006064";
    } else {
        modalBranchInfo.textContent = "🛒 Comprando en: SUCURSAL 1 (Local)";
        modalBranchInfo.style.backgroundColor = "#eee";
        modalBranchInfo.style.color = "#333";
    }

    // 2. Renderizar items
    cartItemsContainer.innerHTML = '';
    let total = 0;

    if (addedQuantities.size === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; padding:20px;">Tu carrito está vacío.</p>';
        checkoutBtn.disabled = true;
    } else {
        checkoutBtn.disabled = false;
        addedQuantities.forEach((qty, id) => {
            const product = allProductsData.find(p => p.data_product_id == id);
            if (product) {
                const subtotal = product.precio * qty;
                total += subtotal;
                
                const row = document.createElement('div');
                row.className = 'cart-item-row';
                row.innerHTML = `
                    <span>${product.nombre} (x${qty})</span>
                    <span>$${subtotal.toFixed(2)}</span>
                `;
                cartItemsContainer.appendChild(row);
            }
        });
    }
    cartTotalDisplay.textContent = total.toFixed(2);
}

async function handleCheckout() {
    if (addedQuantities.size === 0) return;

    // Preparar datos para el backend
    const itemsToBuy = [];
    addedQuantities.forEach((qty, id) => {
        itemsToBuy.push({ id: id, qty: qty });
    });

    // Determinar sucursal (Si es Admin -> Sucursal 2, Si es User -> Sucursal 1)
    const targetSucursal = isAdminLoggedIn ? 2 : 1;

    checkoutBtn.textContent = "Procesando...";
    checkoutBtn.disabled = true;

    try {
        const res = await fetch('/api/compra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sucursal: targetSucursal, 
                items: itemsToBuy 
            })
        });

        const data = await res.json();

        if (data.success) {
            alert(`✅ ¡Compra realizada con éxito!\n\n${data.message}`);
            
            // Limpiar carrito
            addedQuantities.clear();
            cartCountEl.textContent = '0';
            cartModal.classList.add('hidden');
            
            // Recargar datos para ver el stock actualizado
            await loadData(); 
            // Re-aplicar filtros para mantener la vista
            applyFilters();

        } else {
            alert("❌ Error en la compra: " + data.error);
        }

    } catch (err) {
        alert("❌ Error de conexión con el servidor.");
        console.error(err);
    } finally {
        checkoutBtn.textContent = "Pagar y Descontar Stock";
        checkoutBtn.disabled = false;
    }
}


// --------- FUNCIONES DE AYUDA -----------
function handleQty(id, change) {
    let qty = productQuantities.get(id) || 1;
    qty += change;
    if (qty < 1) qty = 1;
    productQuantities.set(id, qty);
    const card = document.querySelector(`.card[data-product-id="${id}"]`);
    if(card) {
        card.querySelector('.quantity-display').textContent = qty;
        card.querySelector('.minus-btn').disabled = qty <= 1;
    }
}

function handleToggleCart(id, btn) {
    let totalItems = Number(cartCountEl.textContent);
    
    if (!addedQuantities.has(id)) {
        // Agregar
        const qty = productQuantities.get(id) || 1;
        addedQuantities.set(id, qty);
        cartCountEl.textContent = totalItems + qty;
        
        btn.textContent = `En carrito (${qty})`;
        btn.classList.add('remove-state');
    } else {
        // Quitar (Simplificado: quita todo)
        const qty = addedQuantities.get(id);
        addedQuantities.delete(id);
        cartCountEl.textContent = totalItems - qty;
        
        btn.textContent = 'Agregar';
        btn.classList.remove('remove-state');
    }
}

function applyFilters() {
    const stockCheckbox = document.querySelector('.checkbox input');
    const soloEnStock = stockCheckbox ? stockCheckbox.checked : false;

    const filtrados = allProductsData.filter(p => {
        // Categoria
        const catMatch = (currentCategoryFilter === 'Todos' || currentCategoryFilter === 'TOP') || (p.data_category === currentCategoryFilter);
        
        // Stock Dinámico
        let stockMatch = true;
        if (soloEnStock) {
            const stock = getStockSeguro(p);
            stockMatch = isAdminLoggedIn ? (stock.sucursal_2 > 0) : (stock.sucursal_1 > 0);
        }

        // Búsqueda
        const text = (p.nombre + " " + p.descripcion).toLowerCase();
        const searchMatch = text.includes(currentSearchTerm);

        return catMatch && stockMatch && searchMatch;
    });
    renderProductos(filtrados);
}

// --------- ADMIN -----------
function handleAdminLogin(e) {
    e.preventDefault();
    if (adminPassInput.value === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        adminLoginForm.classList.add('hidden');
        adminStatus.classList.remove('hidden');
        adminError.classList.add('hidden');
        productGridEl.classList.add('admin-view');
        applyFilters(); 
    } else {
        adminError.classList.remove('hidden');
        adminError.textContent = 'Password incorrecto';
    }
    adminPassInput.value = '';
}

function handleAdminLogout() {
    isAdminLoggedIn = false;
    adminLoginForm.classList.remove('hidden');
    adminStatus.classList.add('hidden');
    productGridEl.classList.remove('admin-view');
    document.querySelectorAll('.stock-sucursal-2').forEach(s => s.classList.add('hidden'));
    applyFilters();
}