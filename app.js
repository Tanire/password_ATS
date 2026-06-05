/**
 * App Controller Module
 * Manages UI, routing, event handlers, crypto bindings, and offline caching.
 */

// App State
const state = {
    vault: {
        version: "1.04",
        company_name: "ATS TEC",
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
    document.getElementById("menu-expenses").addEventListener("click", () => switchScreen("expenses-submenu"));

    // V1.05 Expenses Submenu Navigation
    document.getElementById("menu-sub-hours").addEventListener("click", () => switchScreen("hours"));
    document.getElementById("menu-sub-diets").addEventListener("click", () => switchScreen("diets"));
    document.getElementById("menu-sub-materials").addEventListener("click", () => switchScreen("materials"));

    // V1.05 Back buttons
    document.getElementById("btn-back-hours-submenu").addEventListener("click", () => switchScreen("expenses-submenu"));
    document.getElementById("btn-back-diets-submenu").addEventListener("click", () => switchScreen("expenses-submenu"));
    document.getElementById("btn-back-materials-submenu").addEventListener("click", () => switchScreen("expenses-submenu"));

    document.getElementById("btn-back-hours-list").addEventListener("click", () => switchScreen("hours"));
    document.getElementById("btn-back-diets-list").addEventListener("click", () => switchScreen("diets"));
    document.getElementById("btn-back-materials-list").addEventListener("click", () => switchScreen("materials"));

    // V1.05 Add buttons
    document.getElementById("btn-new-hour").addEventListener("click", () => openHourForm(null));
    document.getElementById("btn-new-diet").addEventListener("click", () => openDietForm(null));
    document.getElementById("btn-new-material").addEventListener("click", () => openMaterialForm(null));

    // V1.05 Search filters
    document.getElementById("search-hours").addEventListener("input", renderHours);
    document.getElementById("search-diets").addEventListener("input", renderDiets);
    document.getElementById("search-materials").addEventListener("input", renderMaterials);

    // V1.05 Form submits
    document.getElementById("form-hour").addEventListener("submit", saveHourEntry);
    document.getElementById("form-diet").addEventListener("submit", saveDietEntry);
    document.getElementById("form-material").addEventListener("submit", saveMaterialEntry);

    // V1.05 File inputs preview handlers
    document.getElementById("diet-file").addEventListener("change", (e) => handleFilePreview(e, "diet-img-preview"));
    document.getElementById("material-file").addEventListener("change", (e) => handleFilePreview(e, "material-img-preview"));

    // V1.05 Close image viewer
    document.getElementById("btn-close-image-viewer").addEventListener("click", () => {
        document.getElementById("screen-image-viewer").classList.remove("active");
        switchScreen(state.previousScreen || "expenses-submenu");
    });

    // V1.05 Export button
    document.getElementById("btn-export-pdf").addEventListener("click", exportMonthlyReport);

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
        const len = parseInt(document.getElementById("sub-pass-length").value) || 6;
        let pass = "";
        if (type === "alarm") {
            pass = generateNumericPassword(len);
        } else if (type === "recorder") {
            pass = generateAlphanumericPassword(len);
        } else {
            pass = generateComplexPassword(len);
        }
        document.getElementById("sub-password").value = pass;
        showToast(`Clave para equipo (${type}, ${len} caracteres) generada`);
    });

    // Form Submissions
    els.formPassword.addEventListener("submit", savePasswordEntry);
    els.formSubscriber.addEventListener("submit", saveSubscriberEntry);
    els.formExpense.addEventListener("submit", saveExpenseEntry);
    document.getElementById("form-user").addEventListener("submit", saveUserAction);
    document.getElementById("form-manual").addEventListener("submit", saveManualAction);

    // New item buttons
    document.getElementById("btn-new-password").addEventListener("click", () => openPasswordForm(null));
    document.getElementById("btn-new-subscriber").addEventListener("click", () => openSubscriberForm(null));
    document.getElementById("btn-new-expense").addEventListener("click", () => openExpenseForm());
    document.getElementById("btn-add-user").addEventListener("click", () => openUserForm(null));
    document.getElementById("btn-new-manual").addEventListener("click", () => openManualForm(null));

    // Back buttons
    document.getElementById("btn-back-passwords").addEventListener("click", () => switchScreen("passwords"));
    document.getElementById("btn-back-subscribers").addEventListener("click", () => switchScreen("subscribers"));
    document.getElementById("btn-back-manuals-brands").addEventListener("click", () => switchScreen("manuals"));
    document.getElementById("btn-back-manuals-list").addEventListener("click", () => switchScreen("manuals-list"));
    document.getElementById("btn-back-expenses").addEventListener("click", () => switchScreen("expenses"));
    document.getElementById("btn-back-settings").addEventListener("click", () => switchScreen("settings"));
    document.getElementById("btn-back-manuals-list-form").addEventListener("click", () => switchScreen("manuals-list"));
    
    // Delete actions
    document.getElementById("btn-delete-manual").addEventListener("click", deleteManualEntry);

    // V1.04 New Listeners
    document.getElementById("btn-change-my-pass").addEventListener("click", changeMyPassword);
    document.getElementById("btn-new-folder").addEventListener("click", createNewFolderAction);
    document.getElementById("btn-back-sub-list").addEventListener("click", () => switchScreen("subscribers"));
    document.getElementById("btn-sub-view-edit").addEventListener("click", editSubscriberFromView);
    
    document.getElementById("btn-sub-view-copy-user").addEventListener("click", () => {
        if (state.activeSubscriber) copyToClipboard(state.activeSubscriber.usuario);
    });
    
    document.getElementById("btn-sub-view-copy-pass").addEventListener("click", () => {
        if (state.activeSubscriber) copyToClipboard(state.activeSubscriber.password);
    });
    
    document.getElementById("btn-sub-view-map").addEventListener("click", () => {
        if (state.activeSubscriber && state.activeSubscriber.address) {
            const query = encodeURIComponent(state.activeSubscriber.address);
            window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
        } else {
            showToast("Este abonado no tiene dirección registrada");
        }
    });

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
        if (screenId === "subscriber-view" && !scopes.includes("subscribers")) return;
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
        const itemScreen = item.getAttribute("data-screen");
        if (itemScreen === screenId || 
            (itemScreen === "expenses-submenu" && ["hours", "diets", "materials", "form-hour", "form-diet", "form-material"].includes(screenId))) {
            item.classList.add("active");
        }
    });

    // Load dynamic data on switch
    if (screenId === "passwords") renderPasswords();
    if (screenId === "subscribers") renderSubscribers();
    if (screenId === "manuals") renderManualsBrands();
    if (screenId === "hours") renderHours();
    if (screenId === "diets") renderDiets();
    if (screenId === "materials") renderMaterials();
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
        
        if (!state.vault.users) state.vault.users = [];
        if (!state.vault.hours) state.vault.hours = [];
        if (!state.vault.diets) state.vault.diets = [];
        if (!state.vault.materials) state.vault.materials = [];
        if (!state.vault.manual_categories) {
            state.vault.manual_categories = ["Ademco", "DSC", "Paradox", "Risco", "Galaxy", "Ajax", "Texecom", "General"];
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
        
        if (!state.vault.users.some(u => u.username.toLowerCase() === loggedInUsername)) {
            state.vault.users.push(activeUser);
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

        card.addEventListener("click", (evt) => {
            if (evt.target.closest(".item-actions")) return;
            openSubscriberView(e);
        });

        els.listSubscribers.appendChild(card);
    });
}

// C. Manuals Brands Selection Menu
function renderManualsBrands() {
    els.brandGrid.innerHTML = "";
    
    if (!state.vault.manual_categories || state.vault.manual_categories.length === 0) {
        state.vault.manual_categories = ["Ademco", "DSC", "Paradox", "Risco", "Galaxy", "Ajax", "Texecom", "General"];
    }

    const categories = state.vault.manual_categories;
    const isAdmin = state.currentUser && state.currentUser.role === "admin";

    categories.forEach(brand => {
        const card = document.createElement("div");
        card.className = "brand-card anim-fade";
        card.innerHTML = `
            <i class="bx bx-folder" style="color: var(--accent);"></i>
            <span>${brand}</span>
        `;

        if (isAdmin) {
            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn-delete-folder";
            deleteBtn.innerHTML = `<i class="bx bx-x"></i>`;
            deleteBtn.title = `Eliminar carpeta ${brand}`;
            deleteBtn.addEventListener("click", (evt) => {
                evt.stopPropagation();
                deleteFolder(brand);
            });
            card.appendChild(deleteBtn);
        }

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
    state.activeManual = m;
    
    document.getElementById("manual-view-title").textContent = m.title;
    document.getElementById("manual-view-category").textContent = m.category;
    document.getElementById("manual-view-body").textContent = m.content || "(Sin contenido)";
    
    const deleteBtn = document.getElementById("btn-delete-manual");
    if (deleteBtn) {
        deleteBtn.style.display = (state.currentUser && state.currentUser.role === "admin") ? "flex" : "none";
    }
    
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

    if (state.currentUser) {
        state.currentUser.fullName = document.getElementById("set-profile-fullname").value.trim();
        state.currentUser.zona = document.getElementById("set-profile-zona").value.trim();
        state.currentUser.delegacion = document.getElementById("set-profile-delegacion").value.trim();
        state.currentUser.vehiculo = document.getElementById("set-profile-vehiculo").value.trim();
        state.currentUser.tarjeta = document.getElementById("set-profile-tarjeta").value.trim();

        // Update in state.vault.users
        const uIdx = state.vault.users.findIndex(u => u.username.toLowerCase() === state.currentUser.username.toLowerCase());
        if (uIdx !== -1) {
            state.vault.users[uIdx] = { ...state.vault.users[uIdx], ...state.currentUser };
        }
    }
    
    setSyncStatus(false);
    showToast("Ajustes y Perfil guardados. Sincronizando...");
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
        if (loginSubtitle) loginSubtitle.textContent = "Introduce tus credenciales para acceder a ATS TEC.";
        if (loginPassInput) loginPassInput.placeholder = "Contraseña";
    } else {
        if (usernameGroup) usernameGroup.style.display = "none";
        if (loginSubtitle) loginSubtitle.textContent = "Introduce tu Clave Maestra para descifrar la base de datos de ATS TEC.";
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
    
    // Populate profile inputs in Settings
    document.getElementById("set-profile-fullname").value = user.fullName || "";
    document.getElementById("set-profile-zona").value = user.zona || "";
    document.getElementById("set-profile-delegacion").value = user.delegacion || "";
    document.getElementById("set-profile-vehiculo").value = user.vehiculo || "";
    document.getElementById("set-profile-tarjeta").value = user.tarjeta || "";
    
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

// Manuals Administration: Open Form
function openManualForm(m = null) {
    const form = document.getElementById("form-manual");
    form.reset();
    
    const title = document.getElementById("manual-form-title");
    const categorySelect = document.getElementById("manual-category");
    const titleInput = document.getElementById("manual-title-input");
    const contentInput = document.getElementById("manual-content-input");
    const fileInput = document.getElementById("manual-file-input");
    const editId = document.getElementById("manual-edit-id");
    
    // Populate categories dynamically
    if (!state.vault.manual_categories || state.vault.manual_categories.length === 0) {
        state.vault.manual_categories = ["Ademco", "DSC", "Paradox", "Risco", "Galaxy", "Ajax", "Texecom", "General"];
    }
    categorySelect.innerHTML = "";
    state.vault.manual_categories.forEach(c => {
        const option = document.createElement("option");
        option.value = c;
        option.textContent = c;
        categorySelect.appendChild(option);
    });
    
    if (m) {
        title.textContent = "Editar Manual";
        categorySelect.value = m.category || "General";
        titleInput.value = m.title || "";
        contentInput.value = m.content || "";
        fileInput.value = m.file_path || "";
        editId.value = m.id;
    } else {
        title.textContent = "Nuevo Manual";
        categorySelect.value = state.activeCategory || "General";
        titleInput.value = "";
        contentInput.value = "";
        fileInput.value = "";
        editId.value = "";
    }
    
    switchScreen("form-manual");
}

// Manuals Administration: Save
async function saveManualAction(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role !== "admin") {
        showToast("Operación no permitida: se requiere rol Admin");
        return;
    }
    
    const editId = document.getElementById("manual-edit-id").value;
    const category = document.getElementById("manual-category").value;
    const title = document.getElementById("manual-title-input").value.trim();
    const content = document.getElementById("manual-content-input").value.trim();
    const file_path = document.getElementById("manual-file-input").value.trim();
    
    if (!title || !content) {
        showToast("Por favor, rellena título y contenido");
        return;
    }
    
    showLoading(true, "Guardando manual...");
    
    try {
        const manualData = { category, title, content, file_path };
        
        if (!state.vault.manuals) {
            state.vault.manuals = [];
        }
        
        if (editId) {
            const idx = state.vault.manuals.findIndex(m => m.id == editId);
            if (idx !== -1) {
                state.vault.manuals[idx] = { ...state.vault.manuals[idx], ...manualData };
            }
        } else {
            manualData.id = Date.now();
            state.vault.manuals.unshift(manualData);
        }
        
        setSyncStatus(false);
        switchScreen("manuals-list");
        renderManualsList();
        showToast("Manual guardado");
        
        await syncWithCloud();
    } catch (err) {
        console.error("Save manual error:", err);
        showToast("Error al guardar manual");
    } finally {
        showLoading(false);
    }
}

// Manuals Administration: Delete
async function deleteManualEntry() {
    if (state.currentUser && state.currentUser.role !== "admin") {
        showToast("Operación no permitida: se requiere rol Admin");
        return;
    }
    
    const m = state.activeManual;
    if (!m || !m.id) {
        showToast("No hay manual activo para eliminar");
        return;
    }
    
    if (confirm(`¿Estás seguro de que deseas eliminar el manual "${m.title}"?`)) {
        showLoading(true, "Eliminando manual...");
        try {
            state.vault.manuals = state.vault.manuals.filter(item => item.id !== m.id);
            setSyncStatus(false);
            switchScreen("manuals-list");
            renderManualsList();
            showToast("Manual eliminado");
            
            await syncWithCloud();
        } catch (err) {
            console.error("Delete manual error:", err);
            showToast("Error al eliminar manual");
        } finally {
            showLoading(false);
        }
    }
}

// --- V1.04 NEW USER AND FOLDER MANAGEMENT FUNCTIONS ---

async function changeMyPassword() {
    const newPassInput = document.getElementById("set-new-password");
    const newPassword = newPassInput.value.trim();
    
    if (!newPassword) {
        showToast("Por favor, introduce una nueva contraseña");
        return;
    }
    
    if (!state.currentUser) {
        showToast("No hay usuario activo");
        return;
    }
    
    showLoading(true, "Actualizando contraseña...");
    
    try {
        const username = state.currentUser.username.toLowerCase();
        
        // Encrypt the master password with the new password
        const wrappedKey = await encryptData(state.masterPassword, newPassword);
        
        // Save to usersMetadata
        state.usersMetadata[username] = wrappedKey;
        
        // Clear input
        newPassInput.value = "";
        
        setSyncStatus(false);
        showToast("Contraseña actualizada localmente");
        
        // Sync changes
        await syncWithCloud();
    } catch (err) {
        console.error("Change password error:", err);
        showToast("Error al cambiar la contraseña: " + err.message);
    } finally {
        showLoading(false);
    }
}

async function createNewFolderAction() {
    if (state.currentUser && state.currentUser.role !== "admin") {
        showToast("Error: Sólo los administradores pueden crear carpetas");
        return;
    }
    
    const folderName = prompt("Introduce el nombre de la nueva marca o carpeta:");
    if (!folderName) return;
    
    const trimmed = folderName.trim();
    if (!trimmed) return;
    
    if (!state.vault.manual_categories) {
        state.vault.manual_categories = ["Ademco", "DSC", "Paradox", "Risco", "Galaxy", "Ajax", "Texecom", "General"];
    }
    
    const exists = state.vault.manual_categories.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
        showToast("Esa carpeta ya existe");
        return;
    }
    
    state.vault.manual_categories.push(trimmed);
    setSyncStatus(false);
    renderManualsBrands();
    showToast(`Carpeta "${trimmed}" creada`);
    
    await syncWithCloud();
}

async function deleteFolder(brand) {
    if (state.currentUser && state.currentUser.role !== "admin") {
        showToast("Error: Sólo los administradores pueden eliminar carpetas");
        return;
    }
    
    const count = state.vault.manuals ? state.vault.manuals.filter(m => m.category === brand).length : 0;
    let confirmMsg = `¿Estás seguro de que deseas eliminar la carpeta "${brand}"?`;
    if (count > 0) {
        confirmMsg = `¿Estás seguro de que deseas eliminar la carpeta "${brand}"? Se eliminarán también los ${count} manuales asociados.`;
    }
    
    if (confirm(confirmMsg)) {
        showLoading(true, "Eliminando carpeta...");
        try {
            state.vault.manual_categories = state.vault.manual_categories.filter(c => c !== brand);
            
            if (state.vault.manuals) {
                state.vault.manuals = state.vault.manuals.filter(m => m.category !== brand);
            }
            
            setSyncStatus(false);
            renderManualsBrands();
            showToast(`Carpeta "${brand}" eliminada`);
            
            await syncWithCloud();
        } catch (err) {
            console.error("Delete folder error:", err);
            showToast("Error al eliminar la carpeta");
        } finally {
            showLoading(false);
        }
    }
}

function openSubscriberView(sub) {
    state.activeSubscriber = sub;
    
    let emoji = "🔒";
    if (sub.tipo === "alarm") emoji = "🔔";
    else if (sub.tipo === "recorder") emoji = "📹";
    else if (sub.tipo === "camera") emoji = "📷";
    else if (sub.tipo === "system") emoji = "⚙️";
    
    document.getElementById("sub-view-icon").textContent = emoji;
    document.getElementById("sub-view-title").textContent = `[${sub.subscriber_code || "?"}] ${sub.nombre || "Sin Cliente"}`;
    document.getElementById("sub-view-type").textContent = (sub.tipo || "alarm").toUpperCase();
    document.getElementById("sub-view-address").textContent = sub.address || "(Sin dirección)";
    document.getElementById("sub-view-username").textContent = sub.usuario || "-";
    document.getElementById("sub-view-password").textContent = sub.password || "-";
    
    switchScreen("subscriber-view");
}

function editSubscriberFromView() {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (state.activeSubscriber) {
        openSubscriberForm(state.activeSubscriber.id);
    }
}

// --- V1.05 NEW CRUD AND EXPORT LOGIC FOR EXTRAS AND TICKETS ---

// HORAS EXTRAS CRUD
function openHourForm(id = null) {
    const form = document.getElementById("form-hour");
    form.reset();
    document.getElementById("hour-id").value = "";
    document.getElementById("hour-date").value = new Date().toISOString().split('T')[0];
    
    if (id) {
        const entry = state.vault.hours.find(h => h.id === id);
        if (entry) {
            document.getElementById("hour-form-title").textContent = "Editar Horas Extras";
            document.getElementById("hour-id").value = entry.id;
            document.getElementById("hour-date").value = entry.date || "";
            document.getElementById("hour-concept").value = entry.concept || "TRABAJOS";
            document.getElementById("hour-description").value = entry.description || "";
            document.getElementById("hour-start").value = entry.startTime || "";
            document.getElementById("hour-end").value = entry.endTime || "";
        }
    } else {
        document.getElementById("hour-form-title").textContent = "Registrar Horas Extras";
    }
    switchScreen("form-hour");
}

async function saveHourEntry(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    
    const id = document.getElementById("hour-id").value;
    const date = document.getElementById("hour-date").value;
    const concept = document.getElementById("hour-concept").value.trim();
    const description = document.getElementById("hour-description").value.trim();
    const startTime = document.getElementById("hour-start").value;
    const endTime = document.getElementById("hour-end").value;
    
    // Calculate duration
    const hours = calculateTimeDiff(startTime, endTime);
    
    const entryData = {
        date,
        concept,
        description,
        startTime,
        endTime,
        hours,
        user_name: state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO"
    };
    
    if (id) {
        const idx = state.vault.hours.findIndex(h => h.id == id);
        if (idx !== -1) {
            state.vault.hours[idx] = { ...state.vault.hours[idx], ...entryData };
        }
    } else {
        entryData.id = Date.now();
        state.vault.hours.unshift(entryData);
    }
    
    setSyncStatus(false);
    switchScreen("hours");
    showToast("Horas registradas localmente");
    await syncWithCloud();
}

async function deleteHourEntry(id) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (confirm("¿Estás seguro de que deseas eliminar este registro de horas?")) {
        state.vault.hours = state.vault.hours.filter(h => h.id !== id);
        setSyncStatus(false);
        renderHours();
        await syncWithCloud();
    }
}

function renderHours() {
    const list = document.getElementById("list-hours");
    list.innerHTML = "";
    const q = document.getElementById("search-hours").value.trim().toLowerCase();
    
    let filtered = state.vault.hours || [];
    if (q) {
        filtered = filtered.filter(h => {
            return (h.description || "").toLowerCase().includes(q) || 
                   (h.concept || "").toLowerCase().includes(q) ||
                   (h.date || "").includes(q);
        });
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay registros de horas extras</div>`;
        return;
    }
    
    filtered.forEach(h => {
        const card = document.createElement("div");
        card.className = "item-card anim-fade";
        
        const titleText = `${h.description || "Sin cliente"}`;
        const subtext = `⏱️ ${h.date} • ${h.startTime} a ${h.endTime} (${h.hours.substring(0, 5)} hrs) • ${h.user_name}`;
        
        card.innerHTML = `
            <div class="item-card-left">
                <div class="item-logo-container" style="font-size:1.2rem;">⏱️</div>
                <div class="item-details">
                    <span class="item-title">${titleText}</span>
                    <span class="item-sub">${subtext}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-edit" data-id="${h.id}" title="Editar"><i class="bx bx-edit-alt"></i></button>
                <button class="btn-icon btn-delete" data-id="${h.id}" style="color:var(--danger);" title="Eliminar"><i class="bx bx-trash"></i></button>
            </div>
        `;
        
        card.querySelector(".btn-edit").addEventListener("click", (evt) => {
            evt.stopPropagation();
            openHourForm(h.id);
        });
        
        card.querySelector(".btn-delete").addEventListener("click", (evt) => {
            evt.stopPropagation();
            deleteHourEntry(h.id);
        });
        
        list.appendChild(card);
    });
}

// DIETAS CRUD
function openDietForm(id = null) {
    const form = document.getElementById("form-diet");
    form.reset();
    document.getElementById("diet-id").value = "";
    document.getElementById("diet-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("diet-img-preview").style.display = "none";
    document.getElementById("diet-file").removeAttribute("data-base64");
    
    if (id) {
        const entry = state.vault.diets.find(d => d.id === id);
        if (entry) {
            document.getElementById("diet-form-title").textContent = "Editar Dieta";
            document.getElementById("diet-id").value = entry.id;
            document.getElementById("diet-date").value = entry.date || "";
            document.getElementById("diet-client").value = entry.client || "";
            document.getElementById("diet-concept").value = entry.concept || "";
            document.getElementById("diet-amount").value = entry.amount || "";
            
            if (entry.image) {
                document.getElementById("diet-file").dataset.base64 = entry.image;
                const img = document.getElementById("diet-img-preview").querySelector("img");
                img.src = entry.image;
                document.getElementById("diet-img-preview").style.display = "block";
            }
        }
    } else {
        document.getElementById("diet-form-title").textContent = "Registrar Dieta";
    }
    switchScreen("form-diet");
}

async function saveDietEntry(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    
    const id = document.getElementById("diet-id").value;
    const date = document.getElementById("diet-date").value;
    const client = document.getElementById("diet-client").value.trim();
    const concept = document.getElementById("diet-concept").value.trim();
    const amount = parseFloat(document.getElementById("diet-amount").value) || 0;
    const image = document.getElementById("diet-file").dataset.base64 || "";
    
    const entryData = {
        date,
        client,
        concept,
        amount,
        image,
        user_name: state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO"
    };
    
    if (id) {
        const idx = state.vault.diets.findIndex(d => d.id == id);
        if (idx !== -1) {
            state.vault.diets[idx] = { ...state.vault.diets[idx], ...entryData };
        }
    } else {
        entryData.id = Date.now();
        state.vault.diets.unshift(entryData);
    }
    
    setSyncStatus(false);
    switchScreen("diets");
    showToast("Dieta guardada localmente");
    await syncWithCloud();
}

async function deleteDietEntry(id) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (confirm("¿Eliminar este registro de dieta?")) {
        state.vault.diets = state.vault.diets.filter(d => d.id !== id);
        setSyncStatus(false);
        renderDiets();
        await syncWithCloud();
    }
}

function renderDiets() {
    const list = document.getElementById("list-diets");
    list.innerHTML = "";
    const q = document.getElementById("search-diets").value.trim().toLowerCase();
    
    let filtered = state.vault.diets || [];
    if (q) {
        filtered = filtered.filter(d => {
            return (d.client || "").toLowerCase().includes(q) || 
                   (d.concept || "").toLowerCase().includes(q) ||
                   (d.date || "").includes(q);
        });
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay registros de dietas</div>`;
        return;
    }
    
    filtered.forEach(d => {
        const card = document.createElement("div");
        card.className = "item-card anim-fade";
        
        const titleText = `${d.client || "Sin cliente"} • ${parseFloat(d.amount).toFixed(2)}€`;
        const subtext = `🍔 ${d.date} • ${d.concept} • ${d.user_name}`;
        
        let imgHtml = `<div class="item-logo-container" style="font-size:1.2rem;">🍔</div>`;
        if (d.image) {
            imgHtml = `<img src="${d.image}" class="ticket-thumb" title="Ver Ticket">`;
        }
        
        card.innerHTML = `
            <div class="item-card-left">
                <div class="logo-wrapper" style="margin-right: 16px;">${imgHtml}</div>
                <div class="item-details">
                    <span class="item-title">${titleText}</span>
                    <span class="item-sub">${subtext}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-edit" data-id="${d.id}" title="Editar"><i class="bx bx-edit-alt"></i></button>
                <button class="btn-icon btn-delete" data-id="${d.id}" style="color:var(--danger);" title="Eliminar"><i class="bx bx-trash"></i></button>
            </div>
        `;
        
        if (d.image) {
            card.querySelector(".ticket-thumb").addEventListener("click", (evt) => {
                evt.stopPropagation();
                openImageViewer(d.image);
            });
        }
        
        card.querySelector(".btn-edit").addEventListener("click", (evt) => {
            evt.stopPropagation();
            openDietForm(d.id);
        });
        
        card.querySelector(".btn-delete").addEventListener("click", (evt) => {
            evt.stopPropagation();
            deleteDietEntry(d.id);
        });
        
        list.appendChild(card);
    });
}

// MATERIALES CRUD
function openMaterialForm(id = null) {
    const form = document.getElementById("form-material");
    form.reset();
    document.getElementById("material-id").value = "";
    document.getElementById("material-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("material-img-preview").style.display = "none";
    document.getElementById("material-file").removeAttribute("data-base64");
    
    if (id) {
        const entry = state.vault.materials.find(m => m.id === id);
        if (entry) {
            document.getElementById("material-form-title").textContent = "Editar Material";
            document.getElementById("material-id").value = entry.id;
            document.getElementById("material-date").value = entry.date || "";
            document.getElementById("material-client").value = entry.client || "";
            document.getElementById("material-concept").value = entry.concept || "";
            document.getElementById("material-amount").value = entry.amount || "";
            
            if (entry.image) {
                document.getElementById("material-file").dataset.base64 = entry.image;
                const img = document.getElementById("material-img-preview").querySelector("img");
                img.src = entry.image;
                document.getElementById("material-img-preview").style.display = "block";
            }
        }
    } else {
        document.getElementById("material-form-title").textContent = "Registrar Material";
    }
    switchScreen("form-material");
}

async function saveMaterialEntry(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    
    const id = document.getElementById("material-id").value;
    const date = document.getElementById("material-date").value;
    const client = document.getElementById("material-client").value.trim();
    const concept = document.getElementById("material-concept").value.trim();
    const amount = parseFloat(document.getElementById("material-amount").value) || 0;
    const image = document.getElementById("material-file").dataset.base64 || "";
    
    const entryData = {
        date,
        client,
        concept,
        amount,
        image,
        user_name: state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO"
    };
    
    if (id) {
        const idx = state.vault.materials.findIndex(m => m.id == id);
        if (idx !== -1) {
            state.vault.materials[idx] = { ...state.vault.materials[idx], ...entryData };
        }
    } else {
        entryData.id = Date.now();
        state.vault.materials.unshift(entryData);
    }
    
    setSyncStatus(false);
    switchScreen("materials");
    showToast("Material guardado localmente");
    await syncWithCloud();
}

async function deleteMaterialEntry(id) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (confirm("¿Eliminar este registro de material?")) {
        state.vault.materials = state.vault.materials.filter(m => m.id !== id);
        setSyncStatus(false);
        renderMaterials();
        await syncWithCloud();
    }
}

function renderMaterials() {
    const list = document.getElementById("list-materials");
    list.innerHTML = "";
    const q = document.getElementById("search-materials").value.trim().toLowerCase();
    
    let filtered = state.vault.materials || [];
    if (q) {
        filtered = filtered.filter(m => {
            return (m.client || "").toLowerCase().includes(q) || 
                   (m.concept || "").toLowerCase().includes(q) ||
                   (m.date || "").includes(q);
        });
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay registros de materiales</div>`;
        return;
    }
    
    filtered.forEach(m => {
        const card = document.createElement("div");
        card.className = "item-card anim-fade";
        
        const titleText = `${m.client || "Sin cliente"} • ${parseFloat(m.amount).toFixed(2)}€`;
        const subtext = `🛠️ ${m.date} • ${m.concept} • ${m.user_name}`;
        
        let imgHtml = `<div class="item-logo-container" style="font-size:1.2rem;">🛠️</div>`;
        if (m.image) {
            imgHtml = `<img src="${m.image}" class="ticket-thumb" title="Ver Ticket">`;
        }
        
        card.innerHTML = `
            <div class="item-card-left">
                <div class="logo-wrapper" style="margin-right: 16px;">${imgHtml}</div>
                <div class="item-details">
                    <span class="item-title">${titleText}</span>
                    <span class="item-sub">${subtext}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-icon btn-edit" data-id="${m.id}" title="Editar"><i class="bx bx-edit-alt"></i></button>
                <button class="btn-icon btn-delete" data-id="${m.id}" style="color:var(--danger);" title="Eliminar"><i class="bx bx-trash"></i></button>
            </div>
        `;
        
        if (m.image) {
            card.querySelector(".ticket-thumb").addEventListener("click", (evt) => {
                evt.stopPropagation();
                openImageViewer(m.image);
            });
        }
        
        card.querySelector(".btn-edit").addEventListener("click", (evt) => {
            evt.stopPropagation();
            openMaterialForm(m.id);
        });
        
        card.querySelector(".btn-delete").addEventListener("click", (evt) => {
            evt.stopPropagation();
            deleteMaterialEntry(m.id);
        });
        
        list.appendChild(card);
    });
}

// IMAGE UPLOAD COMPRESSION & VIEWER LOGIC
async function handleFilePreview(evt, previewId) {
    const file = evt.target.files[0];
    const previewContainer = document.getElementById(previewId);
    if (!file) {
        previewContainer.style.display = "none";
        return;
    }
    
    showLoading(true, "Comprimiendo imagen de ticket...");
    try {
        const compressedBase64 = await compressAndBase64(file);
        evt.target.dataset.base64 = compressedBase64;
        
        const img = previewContainer.querySelector("img");
        img.src = compressedBase64;
        previewContainer.style.display = "block";
    } catch (err) {
        console.error("Image compression failed:", err);
        showToast("Error al cargar la imagen");
        previewContainer.style.display = "none";
    } finally {
        showLoading(false);
    }
}

function compressAndBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function openImageViewer(base64) {
    state.previousScreen = state.currentScreen;
    document.getElementById("image-viewer-content").src = base64;
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-image-viewer").classList.add("active");
}

// AUXILIARY TIME UTILITIES
function calculateTimeDiff(start, end) {
    if (!start || !end) return "00:00:00";
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    
    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // handle wrap around midnight
    
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function sumTotalHours(hoursArray) {
    let totalMinutes = 0;
    hoursArray.forEach(hStr => {
        if (!hStr) return;
        const parts = hStr.split(":");
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        totalMinutes += h * 60 + m;
    });
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

function getSpanishMonthName(monthNum) {
    const months = {
        "01": "ENERO", "02": "FEBRERO", "03": "MARZO", "04": "ABRIL",
        "05": "MAYO", "06": "JUNIO", "07": "JULIO", "08": "AGOSTO",
        "09": "SEPTIEMBRE", "10": "OCTUBRE", "11": "NOVIEMBRE", "12": "DICIEMBRE"
    };
    return months[monthNum] || monthNum;
}

// MONTHLY REPORT EXPORTER
function exportMonthlyReport() {
    const month = document.getElementById("export-month").value;
    const year = document.getElementById("export-year").value;
    const type = document.getElementById("export-type").value;
    
    const filterPrefix = `${year}-${month}`; // matches "2026-05" in "2026-05-04"
    
    const company = state.vault.company_name || "ATS TEC";
    const userFullName = state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO";
    const zona = state.currentUser ? (state.currentUser.zona || "-") : "-";
    const delegacion = state.currentUser ? (state.currentUser.delegacion || "-") : "-";
    const vehiculo = state.currentUser ? (state.currentUser.vehiculo || "-") : "-";
    const tarjeta = state.currentUser ? (state.currentUser.tarjeta || "-") : "-";
    
    const logoUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/logo.png';
    const monthName = getSpanishMonthName(month);

    if (type === "hours") {
        // Filter hours
        const items = (state.vault.hours || []).filter(h => (h.date || "").startsWith(filterPrefix));
        // Sort ascending
        items.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        const totalSumStr = sumTotalHours(items.map(item => item.hours));
        
        let rowsHtml = "";
        // Pre-create 15 rows for exact print look matching the image
        const maxRows = Math.max(15, items.length);
        for (let i = 0; i < maxRows; i++) {
            const h = items[i];
            if (h) {
                const parts = h.date.split("-");
                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                rowsHtml += `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${h.concept || "TRABAJOS"}</td>
                        <td style="text-align: left; padding-left: 15px;">${h.description || ""}</td>
                        <td>${h.hours}</td>
                    </tr>
                `;
            } else {
                rowsHtml += `
                    <tr>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                    </tr>
                `;
            }
        }
        
        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Horas Extras - \${monthName} \${year}</title>
                <style>
                    body { font-family: 'Outfit', sans-serif; color: #000; padding: 20px; margin: 0; }
                    .report-container { max-width: 800px; margin: 0 auto; }
                    .main-header { display: flex; align-items: center; border: 2.5px solid #000; margin-bottom: 25px; }
                    .main-header-title { flex: 1; text-align: center; font-size: 1.4rem; font-weight: 800; padding: 12px; border-right: 2.5px solid #000; letter-spacing: 0.5px; }
                    .main-header-month { width: 180px; text-align: center; font-size: 1.3rem; font-weight: 800; padding: 12px; background: #f8fafc; }
                    .info-section { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 0.95rem; line-height: 1.8; }
                    .info-box { flex: 1; }
                    .logo-box { text-align: right; }
                    .logo-box img { height: 50px; }
                    .info-row { display: flex; gap: 8px; }
                    .info-label { font-weight: 700; width: 80px; }
                    .info-val { border-bottom: 1.5px solid #000; flex: 1; font-weight: 600; padding-left: 5px; }
                    .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    .data-table th, .data-table td { border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem; }
                    .data-table th { background: #f1f5f9; font-weight: 700; }
                    .total-row td { background: #ffff00; font-weight: 700; border-top: 2.5px solid #000; }
                    .signature-section { margin-top: 50px; font-size: 0.95rem; font-weight: 600; }
                    @media print {
                        body { padding: 0; }
                        .report-container { max-width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="main-header">
                        <div class="main-header-title">HORAS EXTRAS</div>
                        <div class="main-header-month">\${monthName}</div>
                    </div>
                    <div class="info-section">
                        <div class="info-box">
                            <div class="info-row"><span class="info-label">EMPRESA:</span><span class="info-val">\${company.toUpperCase()}</span></div>
                            <div class="info-row" style="margin-top: 10px;"><span class="info-label">NOMBRE:</span><span class="info-val">\${userFullName}</span></div>
                        </div>
                        <div class="logo-box">
                            <img src="\${logoUrl}" alt="Logo" onerror="this.style.display='none';">
                        </div>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 15%;">FECHA</th>
                                <th style="width: 20%;">CONCEPTO</th>
                                <th style="text-align: left; padding-left: 15px;">MOTIVO / DESCRIPCIÓN</th>
                                <th style="width: 18%;">TOTAL EXTRAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${rowsHtml}
                            <tr class="total-row">
                                <td colspan="3" style="text-align: right; padding-right: 15px;">TOTAL HORAS</td>
                                <td>\${totalSumStr}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="signature-section">
                        FIRMA: \${userFullName}
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } else {
        // Consolidated expenses (dietas + materiales)
        const diets = (state.vault.diets || []).filter(d => (d.date || "").startsWith(filterPrefix)).map(d => ({
            date: d.date,
            concept: d.concept || "DIETA",
            amount: parseFloat(d.amount) || 0
        }));
        
        const materials = (state.vault.materials || []).filter(m => (m.date || "").startsWith(filterPrefix)).map(m => ({
            date: m.date,
            concept: m.concept || "MATERIAL",
            amount: parseFloat(m.amount) || 0
        }));
        
        const combined = [...diets, ...materials];
        combined.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        let totalSum = 0;
        combined.forEach(c => totalSum += c.amount);
        
        let rowsHtml = "";
        const maxRows = Math.max(15, combined.length);
        for (let i = 0; i < maxRows; i++) {
            const c = combined[i];
            if (c) {
                const parts = c.date.split("-");
                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">\${formattedDate}</td>
                        <td style="text-align: left; padding-left: 15px;">\${c.concept.toUpperCase()}</td>
                        <td class="num-col">\${c.amount.toFixed(2)} €</td>
                    </tr>
                `;
            } else {
                rowsHtml += `
                    <tr>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                    </tr>
                `;
            }
        }
        
        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Control de Gastos - \${monthName} \${year}</title>
                <style>
                    body { font-family: 'Outfit', sans-serif; color: #000; padding: 20px; margin: 0; }
                    .report-container { max-width: 800px; margin: 0 auto; }
                    .main-header { display: flex; align-items: center; border: 2.5px solid #000; margin-bottom: 20px; }
                    .header-logo { padding: 12px; border-right: 2.5px solid #000; text-align: center; width: 140px; display: flex; align-items: center; justify-content: center; }
                    .header-logo img { height: 40px; }
                    .header-title { flex: 1; text-align: center; font-size: 1.4rem; font-weight: 800; letter-spacing: 0.5px; padding: 12px; border-right: 2.5px solid #000; }
                    .header-side { width: 140px; text-align: center; font-weight: 800; font-size: 1.3rem; padding: 12px; background: #e0f2fe; }
                    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                    .info-grid td { border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; }
                    .bg-light { background: #f1f5f9; font-weight: 700; width: 130px; }
                    .val-field { text-align: center; font-weight: 700; }
                    .data-table { width: 100%; border-collapse: collapse; }
                    .data-table th, .data-table td { border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; }
                    .data-table th { background: #f1f5f9; text-align: center; font-weight: 700; }
                    .data-table td.num-col { text-align: right; font-weight: 600; padding-right: 20px; width: 22%; }
                    .total-row td { font-weight: 800; font-size: 0.95rem; border-top: 2.5px solid #000; }
                    @media print {
                        body { padding: 0; }
                        .report-container { max-width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div class="report-container">
                    <div class="main-header">
                        <div class="header-logo"><img src="\${logoUrl}" alt="Logo" onerror="this.style.display='none';"></div>
                        <div class="header-title">CONTROL DE GASTOS</div>
                        <div class="header-side">GASTOS</div>
                    </div>
                    <table class="info-grid">
                        <tr>
                            <td class="bg-light">ZONA:</td>
                            <td class="val-field" style="width: 35%;">\${zona.toUpperCase()}</td>
                            <td class="bg-light">MES/AÑO:</td>
                            <td class="val-field">\${monthName}</td>
                        </tr>
                        <tr>
                            <td class="bg-light">DELEGACION:</td>
                            <td class="val-field">\${delegacion.toUpperCase()}</td>
                            <td class="bg-light">AÑO:</td>
                            <td class="val-field">\${year}</td>
                        </tr>
                        <tr>
                            <td class="bg-light">TARJETA Nº:</td>
                            <td class="val-field">\${tarjeta.toUpperCase()}</td>
                            <td class="bg-light" rowspan="2">CONDUCTOR:</td>
                            <td class="val-field" rowspan="2" style="vertical-align: middle;">\${userFullName}</td>
                        </tr>
                        <tr>
                            <td class="bg-light">VEHICULO:</td>
                            <td class="val-field">\${vehiculo.toUpperCase()}</td>
                        </tr>
                    </table>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 15%;">DIA</th>
                                <th style="text-align: left; padding-left: 15px;">CONCEPTO</th>
                                <th style="width: 22%;">IMPORTE</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${rowsHtml}
                            <tr class="total-row">
                                <td colspan="2" style="text-align: right; padding-right: 15px; font-weight: 800;">TOTAL</td>
                                <td class="num-col" style="background: #f8fafc; font-weight: 800;">\${totalSum.toFixed(2)} €</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}

function editSubscriberFromView() {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (state.activeSubscriber) {
        openSubscriberForm(state.activeSubscriber.id);
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

