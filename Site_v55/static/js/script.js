// ============================================================================
// SISTEMA DE TRADUÇÃO DINÂMICA
// ============================================================================

// Objeto global de traduções (será preenchido pelo template)
window.translations = window.translations || {};

function getTranslation(key) {
    return window.translations[key] || key;
}

// ============================================================================
// BUSCA E FILTROS DE MAMÍFEROS
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");
    const clearBtn = document.getElementById("clear-btn");
    const mammalsList = document.getElementById("mammals-list");
    const filterButtons = document.querySelectorAll(".filter-btn");

    let activeFilters = {
        region: null,
        taxonomy: null,
    };

    let allMammals = []; // Armazenar todos os mamíferos
    let filteredMammals = []; // Mamíferos após filtros
    let currentPage = 1;
    let itemsPerPage = 20; // Padrão: 20 por página

    // Carregar todos os mamíferos ao iniciar
    function loadAllMammals() {
        console.log('Carregando todos os mamíferos...');
        fetch('/search/')
            .then(response => response.json())
            .then(data => {
                console.log('Mamíferos carregados:', data.length);
                if (data.length > 0) {
                    console.log('Exemplo de mamífero:', data[0]);
                    console.log('Taxonomias únicas:', [...new Set(data.map(m => m.taxonomy_order).filter(t => t))]);
                }
                allMammals = data;
                filteredMammals = data;
                displayMammalsWithPagination();
            })
            .catch(error => console.error('Erro ao carregar mamíferos:', error));
    }

    function performSearch() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
        
        console.log('\n=== PERFORM SEARCH ===');
        console.log('Query:', query);
        console.log('Active Filters:', JSON.stringify(activeFilters));
        console.log('Total mammals loaded:', allMammals.length);
        
        let filtered = allMammals;

        // Filtrar por continente - CORRIGIDO para normalizar acentos
        if (activeFilters.region) {
            filtered = filtered.filter(m => {
                if (!m.continent) return false;
                const continent = m.continent.toLowerCase();
                const filterRegion = activeFilters.region.toLowerCase();
                
                // Normalizar acentos para comparação
                const normalizeStr = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return normalizeStr(continent).includes(normalizeStr(filterRegion)) || 
                       continent.includes(filterRegion);
            });
        }

        // Filtrar por taxonomia - CORRIGIDO DEFINITIVAMENTE
        if (activeFilters.taxonomy) {
            console.log('Filtro de taxonomia ativo:', activeFilters.taxonomy);
            filtered = filtered.filter(m => {
                if (!m.taxonomy_order) {
                    console.log('Mamífero sem taxonomy_order:', m.common_name);
                    return false;
                }
                const taxonomy = String(m.taxonomy_order).toUpperCase().trim();
                const filterTaxonomy = String(activeFilters.taxonomy).toUpperCase().trim();
                const match = taxonomy === filterTaxonomy;
                console.log(`Comparando: "${taxonomy}" === "${filterTaxonomy}" = ${match} (${m.common_name})`);
                return match;
            });
            console.log(`Após filtro de taxonomia: ${filtered.length} mamíferos`);
        }

        // Filtrar por busca de texto
        if (query) {
            filtered = filtered.filter(m => 
                (m.common_name && m.common_name.toLowerCase().includes(query)) ||
                (m.binomial_name && m.binomial_name.toLowerCase().includes(query)) ||
                (m.description && m.description.toLowerCase().includes(query))
            );
        }

        filteredMammals = filtered;
        currentPage = 1; // Resetar para primeira página ao filtrar
        displayMammalsWithPagination();
    }

    function displayMammalsWithPagination() {
        const totalItems = filteredMammals.length;
        const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
        
        // Ajustar página atual se necessário
        if (currentPage > totalPages) currentPage = totalPages || 1;
        
        // Calcular itens da página atual
        let mammalsToDisplay;
        if (itemsPerPage === 'all') {
            mammalsToDisplay = filteredMammals;
        } else {
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            mammalsToDisplay = filteredMammals.slice(startIndex, endIndex);
        }
        
        // Renderizar mamíferos
        renderMammals(mammalsToDisplay);
        
        // Atualizar contador
        const speciesCount = document.getElementById('species-count');
        if (speciesCount) {
            speciesCount.textContent = `${getTranslation('all_species')} (${totalItems})`;
        }
        
        // Atualizar informações de paginação
        updatePaginationInfo(totalItems, totalPages);
    }

    function renderMammals(mammals) {
        if (!mammalsList) return;

        if (mammals.length === 0) {
            mammalsList.innerHTML = `
                <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 3rem; background-color: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow-md);">
                    <p style="font-size: 1.5rem; color: var(--text-light); margin: 0;">🔍 ${getTranslation('no_results')}</p>
                    <p style="font-size: 1rem; color: var(--text-light); margin-top: 0.5rem;">${getTranslation('try_adjust_filters')}</p>
                </div>
            `;
            return;
        }

        const mammalsHTML = mammals
            .map(mammal => `
                <div class="mammal-card">
                    ${mammal.image_filename ? `
                    <div class="card-image">
                        <img src="/static/images/${mammal.image_filename}" 
                             alt="${escapeHtml(mammal.common_name)}"
                             loading="lazy"
                             onerror="this.parentElement.style.display='none'">
                    </div>
                    ` : ''}
                    <div class="card-header">
                        <h4 class="common-name">${escapeHtml(mammal.common_name)}</h4>
                        <p class="binomial-name"><em>${escapeHtml(mammal.binomial_name)}</em></p>
                    </div>
                    <div class="card-body">
                        <p class="description">${escapeHtml(mammal.description.substring(0, 150))}${mammal.description.length > 150 ? '...' : ''}</p>
                    </div>
                    <div class="card-footer">
                        <a href="/mammal/${mammal.id}" class="btn-primary">${getTranslation('view_details')} →</a>
                    </div>
                </div>
            `)
            .join("");

        mammalsList.innerHTML = mammalsHTML;
    }

    function updatePaginationInfo(totalItems, totalPages) {
        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');
        const totalItemsEl = document.getElementById('total-items');
        const firstPageBtn = document.getElementById('first-page-btn');
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const lastPageBtn = document.getElementById('last-page-btn');
        
        if (currentPageEl) currentPageEl.textContent = currentPage;
        if (totalPagesEl) totalPagesEl.textContent = totalPages;
        if (totalItemsEl) totalItemsEl.textContent = totalItems;
        
        // Desabilitar/habilitar botões
        if (firstPageBtn) {
            firstPageBtn.disabled = currentPage === 1;
            firstPageBtn.classList.toggle('disabled', currentPage === 1);
        }
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage === 1;
            prevPageBtn.classList.toggle('disabled', currentPage === 1);
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage === totalPages || itemsPerPage === 'all';
            nextPageBtn.classList.toggle('disabled', currentPage === totalPages || itemsPerPage === 'all');
        }
        if (lastPageBtn) {
            lastPageBtn.disabled = currentPage === totalPages || itemsPerPage === 'all';
            lastPageBtn.classList.toggle('disabled', currentPage === totalPages || itemsPerPage === 'all');
        }
        
        // Ocultar apenas os botões de navegação se "Todos" estiver selecionado
        const paginationNav = document.querySelector('.pagination-nav');
        const paginationTotal = document.querySelector('.pagination-total');
        
        if (paginationNav) {
            paginationNav.style.display = itemsPerPage === 'all' ? 'none' : 'flex';
        }
        if (paginationTotal) {
            paginationTotal.style.display = itemsPerPage === 'all' ? 'none' : 'block';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function clearFilters() {
        if (searchInput) searchInput.value = "";
        activeFilters = { region: null, taxonomy: null };
        filterButtons.forEach(btn => btn.classList.remove("active"));
        filteredMammals = allMammals;
        currentPage = 1;
        displayMammalsWithPagination();
    }

    // Event Listeners
    if (searchBtn) {
        searchBtn.addEventListener("click", performSearch);
    }

    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                performSearch();
            }
        });
        
        // Busca em tempo real
        searchInput.addEventListener("input", performSearch);
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", clearFilters);
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", function () {
            const filterType = this.dataset.filterType;
            const filterValue = this.dataset.filterValue;

            if (activeFilters[filterType] === filterValue) {
                // Desativar filtro
                activeFilters[filterType] = null;
                this.classList.remove("active");
                this.setAttribute("aria-pressed", "false");
            } else {
                // Ativar filtro (remover outros do mesmo tipo)
                filterButtons.forEach((btn) => {
                    if (btn.dataset.filterType === filterType) {
                        btn.classList.remove("active");
                        btn.setAttribute("aria-pressed", "false");
                    }
                });
                activeFilters[filterType] = filterValue;
                this.classList.add("active");
                this.setAttribute("aria-pressed", "true");
            }

            performSearch();
        });
    });

    // Event Listeners de Paginação
    const firstPageBtn = document.getElementById('first-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const lastPageBtn = document.getElementById('last-page-btn');
    const itemsPerPageSelect = document.getElementById('items-per-page');

    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPage = 1;
            displayMammalsWithPagination();
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayMammalsWithPagination();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredMammals.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                displayMammalsWithPagination();
            }
        });
    }

    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredMammals.length / itemsPerPage);
            currentPage = totalPages;
            displayMammalsWithPagination();
        });
    }

    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            itemsPerPage = value === 'all' ? 'all' : parseInt(value);
            currentPage = 1; // Resetar para primeira página
            displayMammalsWithPagination();
        });
    }

    // Carregar mamíferos ao iniciar
    loadAllMammals();
});



// ============================================================================
// MODO ESCURO - TOGGLE DE TEMA
// ============================================================================

(function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.querySelector('.theme-toggle-icon');
    const themeText = document.querySelector('.theme-toggle-text');
    
    if (!themeToggle) return;

    // Carregar tema salvo do localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Event listener para o botão de toggle
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        if (theme === 'dark') {
            themeIcon.textContent = '☀️';
            themeText.textContent = getTranslation('light_theme');
            themeToggle.setAttribute('aria-pressed', 'true');
        } else {
            themeIcon.textContent = '🌙';
            themeText.textContent = getTranslation('dark_theme');
            themeToggle.setAttribute('aria-pressed', 'false');
        }
    }
})();




// ============================================================================
// MENU HAMBÚRGUER MOBILE
// ============================================================================

(function initMobileMenu() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const menuClose = document.getElementById('menu-close');
    const navMenu = document.getElementById('nav-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const navLinks = document.querySelectorAll('.nav-link');

    if (!hamburgerMenu || !navMenu || !menuOverlay) return;

    // Abrir menu
    function openMenu() {
        navMenu.classList.add('active');
        menuOverlay.classList.add('active');
        hamburgerMenu.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden'; // Prevenir scroll
    }

    // Fechar menu
    function closeMenu() {
        navMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        hamburgerMenu.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = ''; // Restaurar scroll
    }

    // Event listeners
    hamburgerMenu.addEventListener('click', openMenu);
    
    if (menuClose) {
        menuClose.addEventListener('click', closeMenu);
    }

    menuOverlay.addEventListener('click', closeMenu);

    // Fechar menu ao clicar em um link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMenu();
            }
        });
    });

    // Fechar menu ao pressionar ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });

    // Fechar menu ao redimensionar para desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });
})();




// ============================================================================
// SCROLL REVEAL - ANIMAÇÃO AO ROLAR A PÁGINA
// ============================================================================

(function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    
    if (revealElements.length === 0) return;

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const revealPoint = 100;

        revealElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            
            if (elementTop < windowHeight - revealPoint) {
                element.classList.add('active');
            }
        });
    };

    // Revelar elementos visíveis ao carregar
    revealOnScroll();

    // Revelar elementos ao rolar
    window.addEventListener('scroll', revealOnScroll);
})();
