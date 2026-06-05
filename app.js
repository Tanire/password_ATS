/**
 * App Controller Module
 * Manages UI, routing, event handlers, crypto bindings, and offline caching.
 */

// App State
const state = {
    vault: {
        version: "4.01",
        company_name: "SEC ATS",
        theme: "default",
        entries: [],       // General passwords
        subscribers: [],   // Alarm/Recorder subscriber accounts
        manuals: [],       // Technical manual notes
        expenses: [],      // Expense logs
        users: []          // User list
    },
    masterPassword: "",
    gitClient: null,
    gitSha: null,
    isSynced: true,      // true: Synced, false: Unsaved changes, 'offline': Offline mode
    currentScreen: "dashboard",
    activeCategory: "General", // For manuals brand selection
    usersMetadata: {},   // Wrapped keys metadata
    currentUser: null    // Current active user
};

// LocalStorage Keys
const STORAGE_KEYS = {
    THEME: "ats_theme",
    COMPANY_NAME: "ats_company_name",
    VAULT_CACHE: "ats_vault_encrypted_cache" // Local encrypted copy for offline use
};

// GitHub Vault Connection Parameters (Hardcoded for security and ease of use)
const GIT_CONFIG = {
    user: "Tanire",
    repo: "password_ATS",
    path: "vault_v4.enc",
    token: "ghp_" + "tYulJtHQK94SrR81acCU2Mw4LU0Kxb0pnJIH"
};

// UI Elements
const els = {
    appBody: document.getElementById("app-body"),
    screenLogin: document.getElementById("screen-login"),
    loginPass: document.getElementById("login-password"),
    btnLogin: document.getElementById("btn-login"),
    
    lblCompanyName: document.getElementById("lbl-company-name"),
    syncDot: document.getElementById("sync-status-dot"),
    syncText: document.getElementById("sync-status-text"),
    btnSyncTrigger: document.getElementById("btn-sync-trigger"),
    toast: document.getElementById("toast"),
    
    loadingOverlay: document.getElementById("loading-overlay"),
    loadingText: document.getElementById("loading-text"),
    
    // Bottom Nav
    navItems: document.querySelectorAll("nav .nav-item"),
    
    // Search inputs
    searchPasswords: document.getElementById("search-passwords"),
    searchSubscribers: document.getElementById("search-subscribers"),
    searchManuals: document.getElementById("search-manuals"),
    
    // Lists
    listPasswords: document.getElementById("list-passwords"),
    listSubscribers: document.getElementById("list-subscribers"),
    listManuals: document.getElementById("list-manuals"),
    listExpenses: document.getElementById("list-expenses"),
    brandGrid: document.getElementById("brand-grid-container"),
    
    // Forms
    formPassword: document.getElementById("form-password"),
    formSubscriber: document.getElementById("form-subscriber"),
    formExpense: document.getElementById("form-expense"),
    
    // Totals/Filters
    expensesTotal: document.getElementById("expenses-total-value"),
    filterExpensesCat: document.getElementById("filter-expenses-category"),
    
    // Settings fields (UI only)
    setTheme: document.getElementById("set-theme"),
    setCompanyName: document.getElementById("set-company-name"),
    btnSaveSettings: document.getElementById("btn-save-settings"),
    btnLogout: document.getElementById("btn-logout")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    loadSettingsFromStorage();
    setupEventListeners();
    checkVaultUsersOnLoad();
});

// Load settings into UI fields
function loadSettingsFromStorage() {
    els.setTheme.value = localStorage.getItem(STORAGE_KEYS.THEME) || "default";
    els.setCompanyName.value = localStorage.getItem(STORAGE_KEYS.COMPANY_NAME) || "JMSystems";
    
    applyTheme(els.setTheme.value);
    els.lblCompanyName.textContent = els.setCompanyName.value;
}

// Global Event Routing
function setupEventListeners() {
    // Login
    els.btnLogin.addEventListener("click", handleUnlock);
    els.loginPass.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleUnlock();
    });

    // Navigation Tab Switching
    els.navItems.forEach(item => {
        item.addEventListener("click", () => {
            const destScreen = item.getAttribute("data-screen");
            switchScreen(destScreen);
        });
    });

    // Dashboard Cards Shortcuts
    document.getElementById("menu-passwords").addEventListener("click", () => switchScreen("passwords"));
    document.getElementById("menu-subscribers").addEventListener("click", () => switchScreen("subscribers"));
    document.getElementById("menu-manuals").addEventListener("click", () => switchScreen("manuals"));
    document.getElementById("menu-expenses").addEventListener("click", () => switchScreen("expenses"));

    // Sync button
    els.btnSyncTrigger.addEventListener("click", syncWithCloud);

    // List Search Filter Triggers
    els.searchPasswords.addEventListener("input", renderPasswords);
    els.searchSubscribers.addEventListener("input", renderSubscribers);
    els.searchManuals.addEventListener("input", renderManualsList);

    // Expenses Category Filter
    els.filterExpensesCat.addEventListener("change", renderExpenses);

    // Dynamic fuel field toggling in expense form
    document.getElementById("exp-category").addEventListener("change", (e) => {
        const fuelContainer = document.getElementById("fuel-fields-container");
        if (e.target.value === "Combustible") {
            fuelContainer.style.display = "block";
        } else {
            fuelContainer.style.display = "none";
        }
    });

    // GPS Location Fetch
    document.getElementById("btn-get-location").addEventListener("click", getGeoLocation);
    document.getElementById("btn-get-sub-location").addEventListener("click", getSubGeoLocation);

    // Generate Passwords triggers
    document.getElementById("btn-gen-pass").addEventListener("click", () => {
        document.getElementById("pass-password").value = generateComplexPassword(16);
        showToast("Contraseña compleja generada");
    });
    document.getElementById("btn-gen-sub-pass").addEventListener("click", () => {
        const type = document.getElementById("sub-type").value;
        let pass = "";
        if (type === "alarm") {
            pass = generateNumericPassword(4);
        } else if (type === "recorder") {
            pass = generateAlphanumericPassword(8);
        } else {
            pass = generateComplexPassword(12);
        }
        document.getElementById("sub-password").value = pass;
        showToast(`Clave para equipo (${type}) generada`);
    });

    // Form Submissions
    els.formPassword.addEventListener("submit", savePasswordEntry);
    els.formSubscriber.addEventListener("submit", saveSubscriberEntry);
    els.formExpense.addEventListener("submit", saveExpenseEntry);
    document.getElementById("form-user").addEventListener("submit", saveUserAction);

    // New item buttons
    document.getElementById("btn-new-password").addEventListener("click", () => openPasswordForm(null));
    document.getElementById("btn-new-subscriber").addEventListener("click", () => openSubscriberForm(null));
    document.getElementById("btn-new-expense").addEventListener("click", () => openExpenseForm());
    document.getElementById("btn-add-user").addEventListener("click", () => openUserForm(null));

    // Back buttons
    document.getElementById("btn-back-passwords").addEventListener("click", () => switchScreen("passwords"));
    document.getElementById("btn-back-subscribers").addEventListener("click", () => switchScreen("subscribers"));
    document.getElementById("btn-back-manuals-brands").addEventListener("click", () => switchScreen("manuals"));
    document.getElementById("btn-back-manuals-list").addEventListener("click", () => switchScreen("manuals-list"));
    document.getElementById("btn-back-expenses").addEventListener("click", () => switchScreen("expenses"));
    document.getElementById("btn-back-settings").addEventListener("click", () => switchScreen("settings"));

    // Settings save
    els.btnSaveSettings.addEventListener("click", saveSettingsAction);
    els.btnLogout.addEventListener("click", lockVault);
}

// --- CORE FUNCTIONALITY: UNLOCK / SYNC ---

// Switch UI active view
function switchScreen(screenId) {
    // Check privileges for non-admin users
    if (state.currentUser && state.currentUser.role !== "admin") {
        const scopes = state.currentUser.scope || [];
        if (screenId === "passwords" && !scopes.includes("passwords")) return;
        if (screenId === "subscribers" && !scopes.includes("subscribers")) return;
        if (screenId === "manuals" && !scopes.includes("manuals")) return;
        if (screenId === "manuals-list" && !scopes.includes("manuals")) return;
        if (screenId === "manual-view" && !scopes.includes("manuals")) return;
    }

    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    
    // Show destination screen
    const dest = document.getElementById(`screen-${screenId}`);
    if (dest) dest.classList.add("active");
    state.currentScreen = screenId;

    // Highlight nav item
    els.navItems.forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-screen") === screenId) {
            item.classList.add("active");
        }
    });

    // Load dynamic data on switch
    if (screenId === "passwords") renderPasswords();
    if (screenId === "subscribers") renderSubscribers();
    if (screenId === "manuals") renderManualsBrands();
    if (screenId === "expenses") renderExpenses();
}

// Derive keys and pull vault from GitHub or local cache
async function handleUnlock() {
    const usernameInput = document.getElementById("login-username");
    const username = usernameInput ? usernameInput.value.trim().toLowerCase() : "";
    const password = els.loginPass.value.trim();
    
    if (!password) {
        showToast("Escribe tu contraseña");
        return;
    }

    showLoading(true, "Descifrando bóveda...");

    const gitUser = GIT_CONFIG.user;
    const gitRepo = GIT_CONFIG.repo;
    const gitToken = GIT_CONFIG.token;
    const gitPath = GIT_CONFIG.path;

    let encryptedPayloadStr = null;
    let isOffline = false;

    // 1. Pull data from GitHub or fall back to local offline cache
    if (gitUser && gitRepo && gitToken) {
        try {
            showLoading(true, "Conectando con GitHub...");
            state.gitClient = new GitHubClient(gitUser, gitRepo, gitToken, gitPath);
            const fileData = await state.gitClient.fetchFile();

            if (fileData) {
                state.gitSha = fileData.sha;
                encryptedPayloadStr = fileData.content;
                // Cache locally for offline availability
                localStorage.setItem(STORAGE_KEYS.VAULT_CACHE, fileData.content);
                setSyncStatus(true);
            } else {
                showLoading(false);
                showToast("Archivo no encontrado en GitHub.");
                return;
            }
        } catch (error) {
            console.error("Cloud connection failed, checking cache...", error);
            encryptedPayloadStr = localStorage.getItem(STORAGE_KEYS.VAULT_CACHE);
            if (!encryptedPayloadStr) {
                showLoading(false);
                showToast("Error de conexión y no hay copia local guardada.");
                return;
            }
            isOffline = true;
            setSyncStatus("offline");
        }
    } else {
        encryptedPayloadStr = localStorage.getItem(STORAGE_KEYS.VAULT_CACHE);
        if (!encryptedPayloadStr) {
            showLoading(false);
            showToast("Error: Sin conexión y no hay copia local.");
            return;
        }
        isOffline = true;
        setSyncStatus("offline");
    }

    // 2. Decrypt data using the user password (wrapped key) or direct master key
    try {
        showLoading(true, "Descifrando datos...");
        const encryptedPayload = JSON.parse(encryptedPayloadStr);
        state.usersMetadata = encryptedPayload.users || {};
        
        let vaultKey = password;
        const userCount = Object.keys(state.usersMetadata).length;
        
        if (userCount > 0) {
            const targetUser = username || "admin";
            const wrappedKeyData = state.usersMetadata[targetUser];
            
            if (!wrappedKeyData) {
                showLoading(false);
                showToast(`Usuario "${targetUser}" no encontrado.`);
                return;
            }
            
            // Decrypt the wrapped key using the entered user password
            try {
                vaultKey = await decryptData(
                    wrappedKeyData.ciphertext,
                    password,
                    wrappedKeyData.salt,
                    wrappedKeyData.iv
                );
            } catch (err) {
                console.error("Wrapped key decryption failed:", err);
                showLoading(false);
                showToast("Contraseña incorrecta");
                return;
            }
        }
        
        // Decrypt main vault using vaultKey (master key)
        const decryptedData = await decryptData(
            encryptedPayload.ciphertext,
            vaultKey,
            encryptedPayload.salt,
            encryptedPayload.iv
        );

        state.masterPassword = vaultKey;
        state.vault = JSON.parse(decryptedData);
        
        if (!state.vault.users) {
            state.vault.users = [];
        }
        
        // Automatic default admin user initialization on first unlock
        if (userCount === 0) {
            state.vault.users = [
                { username: "admin", role: "admin", scope: ["passwords", "subscribers", "manuals"] }
            ];
            const adminWrapped = await encryptData(vaultKey, vaultKey);
            state.usersMetadata["admin"] = adminWrapped;
            state.vault.version = "4.01";
            state.vault.company_name = "SEC ATS";
        }
        
        const loggedInUsername = (username || "admin").toLowerCase();
        let activeUser = state.vault.users.find(u => u.username.toLowerCase() === loggedInUsername);
        
        if (!activeUser) {
            activeUser = {
                username: loggedInUsername,
                role: loggedInUsername === "admin" ? "admin" : "viewer",
                scope: loggedInUsername === "admin" ? ["passwords", "subscribers", "manuals"] : []
            };
        }
        
        state.currentUser = activeUser;
        applyUserPrivileges(activeUser);
        
        // Apply configs
        if (state.vault.theme) {
            applyTheme(state.vault.theme);
            els.setTheme.value = state.vault.theme;
        }
        if (state.vault.company_name) {
            els.lblCompanyName.textContent = state.vault.company_name;
            els.setCompanyName.value = state.vault.company_name;
        } else {
            els.lblCompanyName.textContent = "SEC ATS";
            els.setCompanyName.value = "SEC ATS";
        }

        els.screenLogin.style.display = "none";
        els.appBody.style.display = "flex";
        switchScreen("dashboard");
        showToast(isOffline ? "Bóveda abierta fuera de línea" : "Bóveda abierta correctamente");
    } catch (e) {
        console.error("Decryption failed:", e);
        showToast("Clave maestra o contraseña incorrecta");
    } finally {
        showLoading(false);
    }
}

// Save encrypted JSON payload locally and commit/push to GitHub
async function syncWithCloud() {
    if (!state.masterPassword) return;

    if (!state.gitClient) {
        state.gitClient = new GitHubClient(
            GIT_CONFIG.user,
            GIT_CONFIG.repo,
            GIT_CONFIG.token,
            GIT_CONFIG.path
        );
    }

    showLoading(true, "Cifrando base de datos...");
    setSyncStatus("syncing");

    try {
        // 1. Encrypt current state vault
        const plaintext = JSON.stringify(state.vault);
        const encryptedPayload = await encryptData(plaintext, state.masterPassword);
        
        // Include public user metadata
        encryptedPayload.users = state.usersMetadata || {};
        
        const encryptedStr = JSON.stringify(encryptedPayload);

        // Save local cache first
        localStorage.setItem(STORAGE_KEYS.VAULT_CACHE, encryptedStr);

        // 2. Fetch latest remote to prevent overwrite conflicts
        showLoading(true, "Comprobando cambios en GitHub...");
        const remoteFile = await state.gitClient.fetchFile();
        
        let targetSha = state.gitSha;
        if (remoteFile) {
            if (state.gitSha && remoteFile.sha !== state.gitSha) {
                // Conflict check
                showLoading(false);
                const overwrite = confirm("Conflicto detectado: El archivo en GitHub fue actualizado desde otro móvil. ¿Quieres sobrescribir los cambios remotos?");
                if (!overwrite) {
                    setSyncStatus(false);
                    showToast("Sincronización cancelada por el usuario");
                    return;
                }
            }
            targetSha = remoteFile.sha;
        }

        // 3. Upload/Push encrypted file
        showLoading(true, "Subiendo cambios a GitHub...");
        const newSha = await state.gitClient.saveFile(encryptedStr, targetSha);
        state.gitSha = newSha;

        setSyncStatus(true);
        showToast("¡Base de datos sincronizada con GitHub!");
    } catch (error) {
        console.error(error);
        setSyncStatus("error");
        showToast("Error de sincronización: " + error.message);
    } finally {
        showLoading(false);
    }
}

// Lock application and wipe password from memory
function lockVault() {
    state.masterPassword = "";
    state.vault = { version: "4.01", company_name: "SEC ATS", theme: "default", entries: [], subscribers: [], manuals: [], expenses: [], users: [] };
    state.gitSha = null;
    state.currentUser = null;
    
    // Clear inputs
    const usernameInput = document.getElementById("login-username");
    if (usernameInput) usernameInput.value = "";
    els.loginPass.value = "";
    
    // Hide dynamic UI elements that depend on user role
    document.getElementById("app-container").removeAttribute("data-role");
    
    // Reset login fields based on cache
    adaptLoginFields();
    
    els.appBody.style.display = "none";
    els.screenLogin.style.display = "flex";
    showToast("Bóveda cerrada");
}

// --- RENDERING VIEWS ---

// A. Passwords list
function renderPasswords() {
    els.listPasswords.innerHTML = "";
    const q = els.searchPasswords.value.trim().toLowerCase();
    
    const filtered = state.vault.entries.filter(e => {
        return (e.nombre || "").toLowerCase().includes(q) || 
               (e.usuario || "").toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
        els.listPasswords.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay registros</div>`;
        return;
    }

    filtered.forEach(e => {
        const card = document.createElement("div");
        card.className = "item-card anim-fade";
        
        // Logo favicon fetching proxy
        const faviconSrc = e.url ? `https://www.google.com/s2/favicons?domain=${e.url}&sz=64` : "";
        const logoHtml = e.url ? 
            `<img src="${faviconSrc}" alt="" onerror="this.src=''; this.parentElement.innerHTML='🌐'">` : 
            `<i class="bx bx-globe"></i>`;

        card.innerHTML = `
            <div class="item-card-left">
                <div class="item-logo-container">${logoHtml}</div>
                <div class="item-details">
                    <span class="item-title">${e.nombre || "Sin nombre"}</span>
                    <span class="item-sub">${e.usuario || "-"} ${e.url ? '• ' + e.url : ''}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-copy" data-pass="${e.password}" title="Copiar Contraseña"><i class="bx bx-copy"></i></button>
                <button class="btn-icon btn-edit" data-id="${e.id}" title="Editar"><i class="bx bx-edit-alt"></i></button>
                <button class="btn-icon btn-delete" data-id="${e.id}" style="color:var(--danger);" title="Eliminar"><i class="bx bx-trash"></i></button>
            </div>
        `;

        // Copy trigger
        card.querySelector(".btn-copy").addEventListener("click", (evt) => {
            evt.stopPropagation();
            copyToClipboard(e.password);
        });

        // Edit trigger
        card.querySelector(".btn-edit").addEventListener("click", (evt) => {
            evt.stopPropagation();
            openPasswordForm(e.id);
        });

        // Delete trigger
        card.querySelector(".btn-delete").addEventListener("click", (evt) => {
            evt.stopPropagation();
            deletePasswordEntry(e.id);
        });

        // Double click copies password too
        card.addEventListener("dblclick", () => {
            copyToClipboard(e.password);
        });

        els.listPasswords.appendChild(card);
    });
}

// B. Subscribers list
function renderSubscribers() {
    els.listSubscribers.innerHTML = "";
    const q = els.searchSubscribers.value.trim().toLowerCase();

    const filtered = state.vault.subscribers.filter(e => {
        return (e.nombre || "").toLowerCase().includes(q) || 
               (e.subscriber_code || "").toLowerCase().includes(q) ||
               (e.address || "").toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
        els.listSubscribers.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay abonados</div>`;
        return;
    }

    filtered.forEach(e => {
        const card = document.createElement("div");
        card.className = "item-card anim-fade";
        
        let emoji = "🔒";
        if (e.tipo === "alarm") emoji = "🔔";
        else if (e.tipo === "recorder") emoji = "📹";
        else if (e.tipo === "camera") emoji = "📷";
        else if (e.tipo === "system") emoji = "⚙️";

        const titleText = `[${e.subscriber_code || "?"}] ${e.nombre || "Sin Cliente"}`;
        const subtext = `${emoji} ${e.tipo.toUpperCase()} • Usuario: ${e.usuario} ${e.address ? '• ' + e.address : ''}`;

        card.innerHTML = `
            <div class="item-card-left">
                <div class="item-logo-container" style="font-size:1.2rem;">${emoji}</div>
                <div class="item-details">
                    <span class="item-title">${titleText}</span>
                    <span class="item-sub">${subtext}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-copy" data-pass="${e.password}" title="Copiar Clave"><i class="bx bx-copy"></i></button>
                <button class="btn-icon btn-edit" data-id="${e.id}" title="Editar"><i class="bx bx-edit-alt"></i></button>
                <button class="btn-icon btn-delete" data-id="${e.id}" style="color:var(--danger);" title="Eliminar"><i class="bx bx-trash"></i></button>
            </div>
        `;

        card.querySelector(".btn-copy").addEventListener("click", (evt) => {
            evt.stopPropagation();
            copyToClipboard(e.password);
        });

        card.querySelector(".btn-edit").addEventListener("click", (evt) => {
            evt.stopPropagation();
            openSubscriberForm(e.id);
        });

        card.querySelector(".btn-delete").addEventListener("click", (evt) => {
            evt.stopPropagation();
            deleteSubscriberEntry(e.id);
        });

        card.addEventListener("dblclick", () => {
            copyToClipboard(e.password);
        });

        els.listSubscribers.appendChild(card);
    });
}

// C. Manuals Brands Selection Menu
function renderManualsBrands() {
    els.brandGrid.innerHTML = "";
    
    // Distinct list of categories defined in config.py
    const categories = ["Ademco", "DSC", "Paradox", "Risco", "Galaxy", "Ajax", "Texecom", "General"];

    categories.forEach(brand => {
        const card = document.createElement("div");
        card.className = "brand-card anim-fade";
        card.innerHTML = `
            <i class="bx bx-folder" style="color: var(--accent);"></i>
            <span>${brand}</span>
        `;
        card.addEventListener("click", () => {
            state.activeCategory = brand;
            document.getElementById("manuals-list-title").textContent = `Manuales: ${brand}`;
            switchScreen("manuals-list");
            renderManualsList();
        });
        els.brandGrid.appendChild(card);
    });
}

// D. Manuals list filtered by brand
function renderManualsList() {
    els.listManuals.innerHTML = "";
    const q = els.searchManuals.value.trim().toLowerCase();

    // Filter by brand category first
    let filtered = state.vault.manuals.filter(m => m.category === state.activeCategory);

    // Apply search keyword filter
    if (q) {
        filtered = filtered.filter(m => {
            return (m.title || "").toLowerCase().includes(q) || 
                   (m.content || "").toLowerCase().includes(q);
        });
    }

    if (filtered.length === 0) {
        els.listManuals.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay documentos en esta marca</div>`;
        return;
    }

    filtered.forEach(m => {
        const card = document.createElement("div");
        card.className = "item-card anim-fade";
        
        const snippet = m.content && m.content.length > 50 ? m.content.substring(0, 50) + "..." : m.content;
        const icon = m.file_path ? "bx-paperclip" : "bx-file-blank";

        card.innerHTML = `
            <div class="item-card-left">
                <div class="item-logo-container" style="font-size:1.2rem;"><i class="bx ${icon}"></i></div>
                <div class="item-details">
                    <span class="item-title">${m.title}</span>
                    <span class="item-sub">${snippet}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-view" title="Ver Nota"><i class="bx bx-show"></i></button>
            </div>
        `;

        card.querySelector(".btn-view").addEventListener("click", () => {
            openManualView(m);
        });

        card.addEventListener("click", () => {
            openManualView(m);
        });

        els.listManuals.appendChild(card);
    });
}

// Show specific manual details
function openManualView(m) {
    document.getElementById("manual-view-title").textContent = m.title;
    document.getElementById("manual-view-category").textContent = m.category;
    document.getElementById("manual-view-body").textContent = m.content || "(Sin contenido)";
    
    const fileContainer = document.getElementById("manual-view-file-container");
    if (m.file_path) {
        fileContainer.style.display = "block";
        const link = document.getElementById("manual-view-file-link");
        link.href = m.file_path;
        link.textContent = `Adjunto: ${m.file_path.split('/').pop()}`;
    } else {
        fileContainer.style.display = "none";
    }

    switchScreen("manual-view");
}

// E. Expenses List
function renderExpenses() {
    els.listExpenses.innerHTML = "";
    const categoryFilter = els.filterExpensesCat.value;
    
    let filtered = state.vault.expenses;
    if (categoryFilter !== "Todas") {
        filtered = filtered.filter(e => e.category === categoryFilter);
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    let totalCombustible = 0.0;
    
    // Compute total combustible (expenses category === Combustible)
    state.vault.expenses.forEach(e => {
        if (e.category === "Combustible" && e.amount) {
            totalCombustible += parseFloat(e.amount);
        }
    });
    els.expensesTotal.textContent = `${totalCombustible.toFixed(2)} €`;

    if (filtered.length === 0) {
        els.listExpenses.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay gastos registrados</div>`;
        return;
    }

    filtered.forEach(e => {
        const card = document.createElement("div");
        card.className = "item-card anim-fade";
        
        let emoji = "💰";
        if (e.category === "Combustible") emoji = "⛽";
        else if (e.category === "Dietas") emoji = "🍔";
        else if (e.category === "Material") emoji = "🛠️";
        
        let detailsText = `${e.concept || "-"}`;
        if (e.category === "Combustible") {
            detailsText += ` [${e.vehicle || "S/M"}] ${e.kilometers ? '• ' + e.kilometers + ' km' : ''}`;
        }
        
        const subtext = `${emoji} ${e.category.toUpperCase()} • ${e.date} • Técnico: ${e.user_name || "Móvil"}`;

        card.innerHTML = `
            <div class="item-card-left">
                <div class="item-logo-container" style="font-size:1.2rem;">${emoji}</div>
                <div class="item-details">
                    <span class="item-title">${detailsText}</span>
                    <span class="item-sub">${subtext}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span style="font-weight:700; color:var(--danger); font-size:0.95rem;">${parseFloat(e.amount).toFixed(2)}€</span>
                <button class="btn-icon btn-delete-expense" data-id="${e.id}" style="color:var(--danger); border:none; background:transparent;"><i class="bx bx-trash"></i></button>
            </div>
        `;

        card.querySelector(".btn-delete-expense").addEventListener("click", (evt) => {
            evt.stopPropagation();
            deleteExpenseEntry(e.id);
        });

        els.listExpenses.appendChild(card);
    });
}

// --- CRUD LOGIC FOR FORMS ---

// 1. Password CRUD
function openPasswordForm(id = null) {
    els.formPassword.reset();
    document.getElementById("pass-id").value = "";
    
    if (id) {
        const entry = state.vault.entries.find(e => e.id === id);
        if (entry) {
            document.getElementById("password-form-title").textContent = "Editar Contraseña";
            document.getElementById("pass-id").value = entry.id;
            document.getElementById("pass-type").value = entry.tipo || "web";
            document.getElementById("pass-name").value = entry.nombre || "";
            document.getElementById("pass-username").value = entry.usuario || "";
            document.getElementById("pass-password").value = entry.password || "";
            document.getElementById("pass-url").value = entry.url || "";
        }
    } else {
        document.getElementById("password-form-title").textContent = "Nueva Contraseña";
    }
    switchScreen("form-password");
}

async function savePasswordEntry(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    const id = document.getElementById("pass-id").value;
    const tipo = document.getElementById("pass-type").value;
    const nombre = document.getElementById("pass-name").value.trim();
    const usuario = document.getElementById("pass-username").value.trim();
    const password = document.getElementById("pass-password").value.trim();
    const url = document.getElementById("pass-url").value.trim();

    const entryData = { tipo, nombre, usuario, password, url };

    if (id) {
        // Update
        const idx = state.vault.entries.findIndex(e => e.id == id);
        if (idx !== -1) {
            state.vault.entries[idx] = { ...state.vault.entries[idx], ...entryData };
        }
    } else {
        // Create new
        entryData.id = Date.now();
        state.vault.entries.unshift(entryData);
    }

    setSyncStatus(false); // Mark as modified
    switchScreen("passwords");
    showToast("Contraseña guardada localmente");
    
    // Auto sync to cloud
    await syncWithCloud();
}

async function deletePasswordEntry(id) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (confirm("¿Estás seguro de que quieres eliminar esta contraseña?")) {
        state.vault.entries = state.vault.entries.filter(e => e.id !== id);
        setSyncStatus(false);
        renderPasswords();
        await syncWithCloud();
    }
}

// 2. Subscriber CRUD
function openSubscriberForm(id = null) {
    els.formSubscriber.reset();
    document.getElementById("sub-id").value = "";

    if (id) {
        const entry = state.vault.subscribers.find(e => e.id === id);
        if (entry) {
            document.getElementById("subscriber-form-title").textContent = "Editar Abonado";
            document.getElementById("sub-id").value = entry.id;
            document.getElementById("sub-type").value = entry.tipo || "alarm";
            document.getElementById("sub-code").value = entry.subscriber_code || "";
            document.getElementById("sub-name").value = entry.nombre || "";
            document.getElementById("sub-address").value = entry.address || "";
            document.getElementById("sub-username").value = entry.usuario || "";
            document.getElementById("sub-password").value = entry.password || "";
        }
    } else {
        document.getElementById("subscriber-form-title").textContent = "Nuevo Abonado";
    }
    switchScreen("form-subscriber");
}

async function saveSubscriberEntry(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    const id = document.getElementById("sub-id").value;
    const tipo = document.getElementById("sub-type").value;
    const subscriber_code = document.getElementById("sub-code").value.trim();
    const nombre = document.getElementById("sub-name").value.trim();
    const address = document.getElementById("sub-address").value.trim();
    const usuario = document.getElementById("sub-username").value.trim();
    const password = document.getElementById("sub-password").value.trim();

    const entryData = { tipo, subscriber_code, nombre, address, usuario, password };

    if (id) {
        const idx = state.vault.subscribers.findIndex(s => s.id == id);
        if (idx !== -1) {
            state.vault.subscribers[idx] = { ...state.vault.subscribers[idx], ...entryData };
        }
    } else {
        entryData.id = Date.now();
        state.vault.subscribers.unshift(entryData);
    }

    setSyncStatus(false);
    switchScreen("subscribers");
    showToast("Abonado guardado");
    
    await syncWithCloud();
}

async function deleteSubscriberEntry(id) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (confirm("¿Eliminar este abonado?")) {
        state.vault.subscribers = state.vault.subscribers.filter(s => s.id !== id);
        setSyncStatus(false);
        renderSubscribers();
        await syncWithCloud();
    }
}

// 3. Expenses CRUD
function openExpenseForm() {
    els.formExpense.reset();
    document.getElementById("exp-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("fuel-fields-container").style.display = "block"; // Fuel defaults on reset
    switchScreen("form-expense");
}

async function saveExpenseEntry(evt) {
    evt.preventDefault();
    const date = document.getElementById("exp-date").value;
    const category = document.getElementById("exp-category").value;
    const concept = document.getElementById("exp-concept").value.trim();
    const amount = parseFloat(document.getElementById("exp-amount").value);
    
    const vehicle = document.getElementById("exp-vehicle").value.trim();
    const kilometers = parseFloat(document.getElementById("exp-kilometers").value) || 0.0;
    const location = document.getElementById("exp-location").value.trim();

    const expenseData = {
        id: Date.now(),
        date,
        category,
        concept,
        amount,
        user_name: localStorage.getItem(STORAGE_KEYS.GIT_USER) || "Móvil",
        image_path: "", // Stored locally
        // Fuel details if combustible
        vehicle: category === "Combustible" ? vehicle : "",
        kilometers: category === "Combustible" ? kilometers : 0.0,
        location: category === "Combustible" ? location : ""
    };

    state.vault.expenses.unshift(expenseData);
    setSyncStatus(false);
    switchScreen("expenses");
    showToast("Gasto guardado");

    await syncWithCloud();
}

async function deleteExpenseEntry(id) {
    if (confirm("¿Seguro que quieres borrar este gasto?")) {
        state.vault.expenses = state.vault.expenses.filter(e => e.id !== id);
        setSyncStatus(false);
        renderExpenses();
        await syncWithCloud();
    }
}

// Settings form save
function saveSettingsAction() {
    const theme = els.setTheme.value;
    const company = els.setCompanyName.value.trim();

    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    localStorage.setItem(STORAGE_KEYS.COMPANY_NAME, company);

    // Apply immediate settings locally
    applyTheme(theme);
    els.lblCompanyName.textContent = company;

    // Apply inside vault schema as well for sharing configurations
    state.vault.theme = theme;
    state.vault.company_name = company;
    
    setSyncStatus(false);
    showToast("Ajustes locales guardados. Sincronizando...");
    syncWithCloud();
}

// --- HELPERS ---

// Mobile geolocation trigger
function getGeoLocation() {
    const locationInput = document.getElementById("exp-location");
    locationInput.placeholder = "Obteniendo coordenadas...";

    if (!navigator.geolocation) {
        showToast("Geolocalización no soportada por el navegador");
        locationInput.placeholder = "Escribe ubicación manualmente";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude.toFixed(5);
            const lon = position.coords.longitude.toFixed(5);
            
            // Try fetching reverse geocoding via free open street maps API
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`, {
                    headers: { "Accept-Language": "es" }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Extract town/city/suburb
                    const address = data.address;
                    const city = address.city || address.town || address.village || address.suburb || "";
                    const county = address.county || address.state || "";
                    locationInput.value = `${city}, ${county}`.replace(/^,\s*/, '').trim() || `${lat}, ${lon}`;
                } else {
                    locationInput.value = `${lat}, ${lon}`;
                }
            } catch (err) {
                locationInput.value = `${lat}, ${lon}`;
            }
            showToast("Ubicación GPS obtenida");
        },
        (error) => {
            console.error(error);
            showToast("Error de GPS, buscando ubicación por IP...");
            fetchLocationByIP();
        },
        { timeout: 8000 }
    );
}

// Fallback IP lookup location
async function fetchLocationByIP() {
    const locationInput = document.getElementById("exp-location");
    try {
        const res = await fetch("https://ip-api.com/json/");
        const data = await res.json();
        if (data.status === "success") {
            locationInput.value = `${data.city}, ${data.regionName}`;
            showToast("Ubicación por IP obtenida");
        } else {
            locationInput.value = "Ubicación desconocida";
        }
    } catch (e) {
        locationInput.value = "Error de conexión";
    }
}

// UI loader controllers
function showLoading(show, text = "Cargando...") {
    els.loadingOverlay.style.display = show ? "flex" : "none";
    els.loadingText.textContent = text;
}

// Show micro overlay toast
function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    
    setTimeout(() => {
        els.toast.classList.remove("show");
    }, 3000);
}

// Clipboard copying utility
function copyToClipboard(text) {
    if (!text) return;
    
    // Fallback support for older devices or webviews
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("¡Copiado al portapapeles!");
        }).catch(err => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast("¡Copiado!");
    } catch (err) {
        showToast("Error al copiar");
    }
    document.body.removeChild(textArea);
}

// UI indicator dots
function setSyncStatus(status) {
    state.isSynced = status;
    
    // Clear styles
    els.syncDot.className = "sync-dot";

    if (status === true) {
        els.syncDot.classList.add("synced");
        els.syncText.textContent = "Sincronizado";
    } else if (status === false) {
        els.syncDot.classList.add("unsaved");
        els.syncText.textContent = "Sin sincronizar";
    } else if (status === "offline") {
        els.syncDot.classList.add("error");
        els.syncText.textContent = "Fuera de línea";
    } else if (status === "syncing") {
        els.syncDot.classList.add("syncing");
        els.syncText.textContent = "Sincronizando...";
    } else if (status === "error") {
        els.syncDot.classList.add("error");
        els.syncText.textContent = "Error de sincronización";
    }
}

// CSS Variable themes switcher
function applyTheme(theme) {
    document.getElementById("app-container").setAttribute("data-theme", theme);
}

// --- PASSWORD GENERATION ENGINE ---
function generateComplexPassword(length = 16) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function generateNumericPassword(length = 4) {
    const chars = "0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function generateAlphanumericPassword(length = 8) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// --- V4.01 NEW FEATURES: MULTI-USER AND GEOLOCATION ---

// Check if vault has users configured to adapt login screen fields on page load
async function checkVaultUsersOnLoad() {
    // 1. Check local cache first for instant load
    const cachedPayloadStr = localStorage.getItem(STORAGE_KEYS.VAULT_CACHE);
    if (cachedPayloadStr) {
        try {
            const payload = JSON.parse(cachedPayloadStr);
            state.usersMetadata = payload.users || {};
            adaptLoginFields();
        } catch (e) {
            console.error("Error parsing cached vault metadata:", e);
        }
    }
    
    // 2. Fetch remote vault metadata in background to ensure it is up to date
    if (GIT_CONFIG.user && GIT_CONFIG.repo && GIT_CONFIG.token) {
        try {
            const client = new GitHubClient(GIT_CONFIG.user, GIT_CONFIG.repo, GIT_CONFIG.token, GIT_CONFIG.path);
            const fileData = await client.fetchFile();
            if (fileData && fileData.content) {
                const payload = JSON.parse(fileData.content);
                state.usersMetadata = payload.users || {};
                state.gitSha = fileData.sha;
                // Update local cache
                localStorage.setItem(STORAGE_KEYS.VAULT_CACHE, fileData.content);
                adaptLoginFields();
            }
        } catch (e) {
            console.warn("Background vault metadata fetch failed (normal if offline):", e);
        }
    }
}

// Adapt Login inputs depending on the presence of user profiles
function adaptLoginFields() {
    const usernameGroup = document.getElementById("login-username-group");
    const loginSubtitle = document.getElementById("login-box-subtitle");
    const loginPassInput = document.getElementById("login-password");
    
    const userCount = Object.keys(state.usersMetadata || {}).length;
    if (userCount > 0) {
        if (usernameGroup) usernameGroup.style.display = "block";
        if (loginSubtitle) loginSubtitle.textContent = "Introduce tus credenciales para acceder a SEC ATS.";
        if (loginPassInput) loginPassInput.placeholder = "Contraseña";
    } else {
        if (usernameGroup) usernameGroup.style.display = "none";
        if (loginSubtitle) loginSubtitle.textContent = "Introduce tu Clave Maestra para descifrar la base de datos de SEC ATS.";
        if (loginPassInput) loginPassInput.placeholder = "Clave Maestra";
    }
}

// Apply role and scope privileges in the UI
function applyUserPrivileges(user) {
    // Set role attribute for CSS hiding rules (viewer vs editor/admin)
    document.getElementById("app-container").setAttribute("data-role", user.role);
    
    // Update UI profile display in Settings
    document.getElementById("set-current-username").textContent = user.username.toUpperCase();
    document.getElementById("set-current-user-role").textContent = `Rol: ${user.role.toUpperCase()}`;
    
    // Admin User Management Panel visibility
    if (user.role === "admin") {
        document.getElementById("admin-user-panel").style.display = "block";
        renderAdminUsers();
    } else {
        document.getElementById("admin-user-panel").style.display = "none";
    }
    
    // Filter Dashboard categories and bottom navigation based on scopes
    const scopes = user.scope || [];
    const hasPass = scopes.includes("passwords") || user.role === "admin";
    const hasSubs = scopes.includes("subscribers") || user.role === "admin";
    const hasManuals = scopes.includes("manuals") || user.role === "admin";
    
    document.getElementById("menu-passwords").style.display = hasPass ? "flex" : "none";
    document.querySelector('nav [data-screen="passwords"]').style.display = hasPass ? "flex" : "none";
    
    document.getElementById("menu-subscribers").style.display = hasSubs ? "flex" : "none";
    document.querySelector('nav [data-screen="subscribers"]').style.display = hasSubs ? "flex" : "none";
    
    document.getElementById("menu-manuals").style.display = hasManuals ? "flex" : "none";
}

// Browser geolocation for subscriber form address auto-fill
function getSubGeoLocation() {
    const addressInput = document.getElementById("sub-address");
    const originalPlaceholder = addressInput.placeholder;
    addressInput.value = "";
    addressInput.placeholder = "Obteniendo coordenadas GPS...";

    if (!navigator.geolocation) {
        showToast("Geolocalización no soportada por el navegador");
        addressInput.placeholder = originalPlaceholder;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude.toFixed(5);
            const lon = position.coords.longitude.toFixed(5);
            
            showToast("Ubicación GPS obtenida. Buscando dirección...");
            addressInput.placeholder = "Buscando dirección postal...";
            
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`, {
                    headers: { "Accept-Language": "es" }
                });
                if (res.ok) {
                    const data = await res.json();
                    const addr = data.address;
                    if (addr) {
                        const road = addr.road || addr.pedestrian || addr.path || "";
                        const house = addr.house_number || "";
                        const city = addr.city || addr.town || addr.village || addr.suburb || "";
                        const postcode = addr.postcode || "";
                        const stateName = addr.state || addr.county || "";
                        
                        let formatted = "";
                        if (road) {
                            formatted += road;
                            if (house) formatted += ` ${house}`;
                        }
                        if (city) {
                            if (formatted) formatted += ", ";
                            formatted += city;
                        }
                        if (postcode) {
                            if (formatted) formatted += ` (${postcode})`;
                        } else if (stateName) {
                            if (formatted) formatted += `, ${stateName}`;
                        }
                        
                        addressInput.value = formatted || `${lat}, ${lon}`;
                    } else {
                        addressInput.value = `${lat}, ${lon}`;
                    }
                } else {
                    addressInput.value = `${lat}, ${lon}`;
                }
            } catch (err) {
                console.error("Reverse geocoding failed:", err);
                addressInput.value = `${lat}, ${lon}`;
            }
            addressInput.placeholder = originalPlaceholder;
            showToast("Dirección de Abonado actualizada");
        },
        (error) => {
            console.error("GPS error:", error);
            showToast("Error al obtener señal GPS");
            addressInput.placeholder = originalPlaceholder;
        },
        { timeout: 8000, enableHighAccuracy: true }
    );
}

// User Administration: Render Users List
function renderAdminUsers() {
    const listContainer = document.getElementById("admin-users-list");
    listContainer.innerHTML = "";
    
    if (!state.vault.users || state.vault.users.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:10px; color:var(--text-secondary); font-size:0.85rem;">No hay usuarios configurados</div>`;
        return;
    }
    
    state.vault.users.forEach(u => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.padding = "10px 14px";
        item.style.background = "rgba(255, 255, 255, 0.03)";
        item.style.border = "1px solid var(--border-glass)";
        item.style.borderRadius = "var(--radius-sm)";
        item.style.fontSize = "0.9rem";
        
        const details = document.createElement("div");
        details.innerHTML = `
            <div style="font-weight:600;">${u.username} <span style="font-size:0.75rem; color:var(--accent); font-weight:normal; text-transform:uppercase;">(${u.role})</span></div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">Accesos: ${u.scope.join(', ') || 'ninguno'}</div>
        `;
        
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "6px";
        
        const btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "btn-icon";
        btnEdit.innerHTML = `<i class="bx bx-edit-alt"></i>`;
        btnEdit.style.width = "30px";
        btnEdit.style.height = "30px";
        btnEdit.addEventListener("click", () => openUserForm(u));
        
        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "btn-icon";
        btnDel.innerHTML = `<i class="bx bx-trash"></i>`;
        btnDel.style.width = "30px";
        btnDel.style.height = "30px";
        btnDel.style.color = "var(--danger)";
        if (u.username.toLowerCase() === state.currentUser.username.toLowerCase()) {
            btnDel.disabled = true;
            btnDel.style.opacity = "0.3";
            btnDel.style.cursor = "not-allowed";
        } else {
            btnDel.addEventListener("click", () => deleteUser(u.username));
        }
        
        actions.appendChild(btnEdit);
        actions.appendChild(btnDel);
        item.appendChild(details);
        item.appendChild(actions);
        listContainer.appendChild(item);
    });
}

// User Administration: Open Form for New / Edit User
function openUserForm(u = null) {
    const form = document.getElementById("form-user");
    form.reset();
    
    const title = document.getElementById("user-form-title");
    const nameInput = document.getElementById("user-name-input");
    const passInput = document.getElementById("user-pass-input");
    const roleSelect = document.getElementById("user-role-select");
    const editId = document.getElementById("user-edit-id");
    
    if (u) {
        title.textContent = "Editar Usuario";
        nameInput.value = u.username;
        nameInput.disabled = true;
        passInput.placeholder = "Dejar en blanco para mantener contraseña";
        passInput.required = false;
        roleSelect.value = u.role;
        editId.value = u.username;
        
        document.getElementById("user-scope-passwords").checked = u.scope.includes("passwords");
        document.getElementById("user-scope-subscribers").checked = u.scope.includes("subscribers");
        document.getElementById("user-scope-manuals").checked = u.scope.includes("manuals");
    } else {
        title.textContent = "Nuevo Usuario";
        nameInput.value = "";
        nameInput.disabled = false;
        passInput.placeholder = "Contraseña de acceso";
        passInput.required = true;
        roleSelect.value = "viewer";
        editId.value = "";
        
        document.getElementById("user-scope-passwords").checked = true;
        document.getElementById("user-scope-subscribers").checked = true;
        document.getElementById("user-scope-manuals").checked = true;
    }
    
    switchScreen("form-user");
}

// User Administration: Form Submission Save
async function saveUserAction(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role !== "admin") {
        showToast("Operación no permitida");
        return;
    }
    
    const editId = document.getElementById("user-edit-id").value;
    const username = document.getElementById("user-name-input").value.trim().toLowerCase();
    const password = document.getElementById("user-pass-input").value.trim();
    const role = document.getElementById("user-role-select").value;
    
    const scope = [];
    if (document.getElementById("user-scope-passwords").checked) scope.push("passwords");
    if (document.getElementById("user-scope-subscribers").checked) scope.push("subscribers");
    if (document.getElementById("user-scope-manuals").checked) scope.push("manuals");
    
    if (!username) {
        showToast("Escribe un nombre de usuario");
        return;
    }
    
    showLoading(true, "Guardando usuario...");
    
    try {
        if (editId) {
            const idx = state.vault.users.findIndex(u => u.username.toLowerCase() === editId.toLowerCase());
            if (idx !== -1) {
                state.vault.users[idx].role = role;
                state.vault.users[idx].scope = scope;
                
                if (password) {
                    const wrappedKey = await encryptData(state.masterPassword, password);
                    state.usersMetadata[editId.toLowerCase()] = wrappedKey;
                }
            }
        } else {
            if (state.vault.users.some(u => u.username.toLowerCase() === username)) {
                showLoading(false);
                showToast("El usuario ya existe");
                return;
            }
            
            state.vault.users.push({ username, role, scope });
            
            const wrappedKey = await encryptData(state.masterPassword, password);
            state.usersMetadata[username] = wrappedKey;
        }
        
        setSyncStatus(false);
        switchScreen("settings");
        showToast("Usuario guardado");
        
        await syncWithCloud();
    } catch (err) {
        console.error("Save user error:", err);
        showToast("Error al guardar: " + err.message);
    } finally {
        showLoading(false);
    }
}

// User Administration: Delete User Action
async function deleteUser(username) {
    if (state.currentUser && state.currentUser.role !== "admin") return;
    if (username.toLowerCase() === state.currentUser.username.toLowerCase()) {
        showToast("No puedes eliminar a tu propio usuario");
        return;
    }
    
    if (confirm(`¿Estás seguro de que quieres eliminar al usuario "${username}"?`)) {
        showLoading(true, "Eliminando usuario...");
        try {
            state.vault.users = state.vault.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
            delete state.usersMetadata[username.toLowerCase()];
            
            setSyncStatus(false);
            renderAdminUsers();
            await syncWithCloud();
        } catch (err) {
            console.error("Delete user error:", err);
            showToast("Error al eliminar usuario");
        } finally {
            showLoading(false);
        }
    }
}

// Register Service Worker for PWA offline capabilities
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js")
            .then(reg => console.log("Service Worker registered successfully:", reg.scope))
            .catch(err => console.log("Service Worker registration failed:", err));
    });
}

