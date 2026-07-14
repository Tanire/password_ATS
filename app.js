/**
 * App Controller Module
 * Manages UI, routing, event handlers, crypto bindings, and offline caching.
 */

// App State
const state = {
    vault: {
        version: "1.15.00",
        company_name: "ALTA TECNOLOGIA PARA LA SEGURIDAD",
        theme: "default",
        entries: [],       // General passwords
        subscribers: [],   // Alarm/Recorder subscriber accounts
        manuals: [],       // Technical manual notes
        expenses: [],      // Expense logs
        users: [],         // User list
        commercial_reports: [], // Technical-commercial reports
        vacations: []      // Vacation requests v1.14.00
    },
    masterPassword: "",
    gitClient: null,
    gitSha: null,
    isSynced: true,      // true: Synced, false: Unsaved changes, 'offline': Offline mode
    currentScreen: "dashboard",
    vacation: {
        currentDate: new Date(),
        editingId: null,
        activeView: "monthly"
    },
    activeCategory: "General", // For manuals brand selection
    usersMetadata: {},   // Wrapped keys metadata
    currentUser: null,   // Current active user
    isProcessingQueue: false, // Prevent double processing of offline queue
    
    // Commercial module state
    commercial: {
        id: '', // Unique ID for historical tracking
        mode: '', // 'nueva' or 'migracion'
        logoBase64: '', // loaded on startup
        client: {
            name: '',
            phone: '',
            email: '',
            address: '',
            blueprintPhoto: ''
        },
        selectedDisciplines: [],
        currentDisciplineIndex: 0,
        intrusion: {
            brand: '',
            grade: '2',
            pirs: 0,
            contacts: 0,
            sirens: 0,
            keypads: 0,
            cra: 'no',
            maintenance: 'no',
            photos: []
        },
        cctv: {
            recorderBrand: '',
            cameraBrand: '',
            camerasIndoor: 0,
            camerasOutdoor: 0,
            tech: 'IP',
            storage: 7,
            photos: []
        },
        incendios: {
            brand: '',
            type: 'Convencional',
            detectors: 0,
            callpoints: 0,
            photos: []
        },
        generalPhotos: {},
        migration: {
            panelModel: '',
            comms: 'IP',
            cctvStatus: 'Buen estado',
            notes: '',
            photos: []
        },
        inventory: [
            { name: 'Detectores Volumétricos', qty: 0, status: 'Reutilizar' },
            { name: 'Contactos Magnéticos', qty: 0, status: 'Reutilizar' },
            { name: 'Teclados', qty: 0, status: 'Reutilizar' },
            { name: 'Sirenas', qty: 0, status: 'Reutilizar' },
            { name: 'Cámaras Analógicas', qty: 0, status: 'Reutilizar' },
            { name: 'Grabador DVR/NVR', qty: 0, status: 'Sustituir' }
        ],
        rounds: {
            travelTime: 0,
            travelKm: 0,
            points: []
        }
    }
};

// LocalStorage Keys
const STORAGE_KEYS = {
    THEME: "ats_theme",
    COMPANY_NAME: "ats_company_name",
    VAULT_CACHE: "ats_vault_encrypted_cache", // Local encrypted copy for offline use
    OFFLINE_QUEUE: "ats_offline_queue"
};

// GitHub Vault Connection Parameters (Hardcoded for security and ease of use)
const GIT_CONFIG = {
    user: "Tanire",
    repo: "password_ATS",
    path: "vault_v4.enc",
    token: "ghp_" + "tYulJtHQK94SrR81acCU2Mw4LU0Kxb0pnJIH"
};

// Telegram Notifications Bot Parameters
const TELEGRAM_CONFIG = {
    token: "8850530739:AAHnZ0hrNrMFV0iE2ej0QFN5_JyWRKGkgUs",
    chatId: "-5339733647"
};

// Google Apps Script Webhook Configuration
const GOOGLE_CONFIG = {
    webhookUrl: "https://script.google.com/macros/s/AKfycbzJxA22_TBKN8qjzG1dJiPBOeabojWS3NWTS422WR0Ku3kexKnMBWYZjHGtGdtika80/exec" // Replace with deployed Web App URL
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
    inicializarSincronizacionAutomatica();
    loadLogoAsBase64();
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

    // Subscriber password range update listener
    const subRange = document.getElementById("sub-pass-length-range");
    const subRangeVal = document.getElementById("sub-pass-length-val");
    if (subRange && subRangeVal) {
        subRange.addEventListener("input", (e) => {
            subRangeVal.textContent = e.target.value;
        });
    }

    // Dashboard Cards Shortcuts
    document.getElementById("menu-passwords").addEventListener("click", () => switchScreen("passwords"));
    document.getElementById("menu-subscribers").addEventListener("click", () => switchScreen("subscribers"));
    document.getElementById("menu-manuals").addEventListener("click", () => switchScreen("manuals"));
    document.getElementById("menu-expenses").addEventListener("click", () => switchScreen("expenses-submenu"));

    // V1.05 Expenses Submenu Navigation
    document.getElementById("menu-sub-hours").addEventListener("click", () => switchScreen("hours"));
    document.getElementById("menu-sub-diets").addEventListener("click", () => switchScreen("diets"));
    document.getElementById("menu-sub-materials").addEventListener("click", () => switchScreen("materials"));
    document.getElementById("menu-sub-expenses").addEventListener("click", () => switchScreen("expenses"));

    // V1.05 Back buttons
    document.getElementById("btn-back-hours-submenu").addEventListener("click", () => switchScreen("expenses-submenu"));
    document.getElementById("btn-back-diets-submenu").addEventListener("click", () => switchScreen("expenses-submenu"));
    document.getElementById("btn-back-materials-submenu").addEventListener("click", () => switchScreen("expenses-submenu"));
    document.getElementById("btn-back-expenses-submenu-general").addEventListener("click", () => switchScreen("expenses-submenu"));

    document.getElementById("btn-back-hours-list").addEventListener("click", () => switchScreen("hours"));
    document.getElementById("btn-back-diets-list").addEventListener("click", () => switchScreen("diets"));
    document.getElementById("btn-back-materials-list").addEventListener("click", () => switchScreen("materials"));

    // V1.05 Add buttons
    document.getElementById("btn-new-hour").addEventListener("click", () => openHourForm(null));
    document.getElementById("btn-new-diet").addEventListener("click", () => openDietForm(null));
    document.getElementById("btn-new-material").addEventListener("click", () => openMaterialForm(null));

    // V1.05 Search filters
    document.getElementById("search-hours").addEventListener("input", debounce(renderHours));
    document.getElementById("search-diets").addEventListener("input", debounce(renderDiets));
    document.getElementById("search-materials").addEventListener("input", debounce(renderMaterials));

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

    // List Search Filter Triggers (debounced for mobile performance)
    els.searchPasswords.addEventListener("input", debounce(renderPasswords));
    els.searchSubscribers.addEventListener("input", debounce(renderSubscribers));
    els.searchManuals.addEventListener("input", debounce(renderManualsList));

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
        const len = parseInt(document.getElementById("sub-pass-length-range").value) || 6;
        const useUpper = document.getElementById("sub-opt-upper").checked;
        const useLower = document.getElementById("sub-opt-lower").checked;
        const useNumber = document.getElementById("sub-opt-number").checked;
        const useSymbol = document.getElementById("sub-opt-symbol").checked;

        let pass = generateCustomPassword(len, { upper: useUpper, lower: useLower, number: useNumber, symbol: useSymbol });
        document.getElementById("sub-password").value = pass;
        showToast(`Clave generada (${len} caracteres)`);
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

    // ==========================================
    // COMMERCIAL LISTENERS
    // ==========================================
    const menuComm = document.getElementById("menu-commercial");
    if (menuComm) {
        menuComm.addEventListener("click", () => switchScreen("commercial-home"));
    }
    const btnBackCommHome = document.getElementById("btn-back-commercial-home-dash");
    if (btnBackCommHome) {
        btnBackCommHome.addEventListener("click", () => switchScreen("dashboard"));
    }
    const btnModeNew = document.getElementById("btn-mode-new");
    if (btnModeNew) {
        btnModeNew.addEventListener("click", () => {
            state.commercial.id = ''; // Reset ID since this is a new report
            state.commercial.mode = 'nueva';
            document.getElementById('client-title').innerText = 'Datos de Nueva Instalación';
            switchScreen('commercial-client-details');
        });
    }
    const btnModeMigrate = document.getElementById("btn-mode-migrate");
    if (btnModeMigrate) {
        btnModeMigrate.addEventListener("click", () => {
            state.commercial.id = ''; // Reset ID since this is a new report
            state.commercial.mode = 'migracion';
            document.getElementById('client-title').innerText = 'Datos de Auditoría / Migración';
            switchScreen('commercial-client-details');
        });
    }
    const btnModeRounds = document.getElementById("btn-mode-rounds");
    if (btnModeRounds) {
        btnModeRounds.addEventListener("click", () => {
            state.commercial.id = ''; // Reset ID since this is a new report
            state.commercial.mode = 'rondas';
            document.getElementById('client-title').innerText = 'Datos de Rondas de Vigilantes';
            switchScreen('commercial-client-details');
        });
    }
    const clientForm = document.getElementById('client-form');
    if (clientForm) {
        clientForm.addEventListener('submit', (e) => {
            e.preventDefault();
            state.commercial.client.name = document.getElementById('input-client-name').value;
            state.commercial.client.phone = document.getElementById('input-client-phone').value;
            state.commercial.client.email = document.getElementById('input-client-email').value;
            state.commercial.client.address = document.getElementById('input-client-address').value;

            if (state.commercial.mode === 'nueva') {
                switchScreen('commercial-disciplines');
            } else if (state.commercial.mode === 'rondas') {
                renderRoundsForm();
                switchScreen('commercial-rounds');
            } else {
                renderInventoryTable();
                switchScreen('commercial-migration');
            }
        });
    }
    const btnBackClient = document.getElementById('btn-back-client');
    if (btnBackClient) {
        btnBackClient.addEventListener('click', () => switchScreen('commercial-home'));
    }
    const btnBackClientHome = document.getElementById('btn-back-client-home');
    if (btnBackClientHome) {
        btnBackClientHome.addEventListener('click', () => switchScreen('commercial-home'));
    }
    const btnBackDisc = document.getElementById('btn-back-disciplines');
    if (btnBackDisc) {
        btnBackDisc.addEventListener('click', () => switchScreen('commercial-client-details'));
    }
    const btnBackDiscCli = document.getElementById('btn-back-disciplines-client');
    if (btnBackDiscCli) {
        btnBackDiscCli.addEventListener('click', () => switchScreen('commercial-client-details'));
    }
    document.querySelectorAll('.discipline-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
            card.classList.toggle('selected', card.querySelector('input[type="checkbox"]').checked);
        });
    });
    const discForm = document.getElementById('disciplines-form');
    if (discForm) {
        discForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const checked = Array.from(document.querySelectorAll('input[name="discipline"]:checked'))
                                 .map(cb => cb.value);
            
            if (checked.length === 0) {
                showToast('Selecciona al menos una disciplina');
                return;
            }
            state.commercial.selectedDisciplines = checked;
            state.commercial.currentDisciplineIndex = 0;
            startWizard();
        });
    }
    const btnWizPrev = document.getElementById('btn-wizard-prev');
    if (btnWizPrev) {
        btnWizPrev.addEventListener('click', () => {
            if (state.commercial.currentDisciplineIndex > 0) {
                state.commercial.currentDisciplineIndex--;
                showWizardStep();
            } else {
                switchScreen('commercial-disciplines');
            }
        });
    }
    const btnWizBackCtrl = document.getElementById('btn-wizard-back-control');
    if (btnWizBackCtrl) {
        btnWizBackCtrl.addEventListener('click', () => {
            if (state.commercial.currentDisciplineIndex > 0) {
                state.commercial.currentDisciplineIndex--;
                showWizardStep();
            } else {
                switchScreen('commercial-disciplines');
            }
        });
    }
    const wizForm = document.getElementById('wizard-form');
    if (wizForm) {
        wizForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveCurrentWizardStepData();
            if (state.commercial.currentDisciplineIndex < state.commercial.selectedDisciplines.length - 1) {
                state.commercial.currentDisciplineIndex++;
                showWizardStep();
            } else {
                generateSummary();
                switchScreen('commercial-summary');
            }
        });
    }
    const btnBackMig = document.getElementById('btn-back-migration');
    if (btnBackMig) {
        btnBackMig.addEventListener('click', () => switchScreen('commercial-client-details'));
    }
    const btnBackMigCli = document.getElementById('btn-back-migration-client');
    if (btnBackMigCli) {
        btnBackMigCli.addEventListener('click', () => switchScreen('commercial-client-details'));
    }
    const migForm = document.getElementById('migration-form');
    if (migForm) {
        migForm.addEventListener('submit', (e) => {
            e.preventDefault();
            state.commercial.migration.panelModel = document.getElementById('input-mig-panel').value;
            state.commercial.migration.comms = document.getElementById('select-mig-comms').value;
            state.commercial.migration.cctvStatus = document.getElementById('select-mig-cctv').value;
            state.commercial.migration.notes = document.getElementById('textarea-mig-notes').value;
            saveInventoryData();
            generateSummary();
            switchScreen('commercial-summary');
        });
    }
    const btnBackSum = document.getElementById('btn-back-summary');
    if (btnBackSum) {
        btnBackSum.addEventListener('click', () => {
            if (state.commercial.mode === 'nueva') {
                state.commercial.currentDisciplineIndex = state.commercial.selectedDisciplines.length - 1;
                switchScreen('commercial-wizard');
                showWizardStep();
            } else if (state.commercial.mode === 'rondas') {
                switchScreen('commercial-rounds');
            } else {
                switchScreen('commercial-migration');
            }
        });
    }
    const btnBackSumEdit = document.getElementById('btn-back-summary-edit');
    if (btnBackSumEdit) {
        btnBackSumEdit.addEventListener('click', () => {
            if (state.commercial.mode === 'nueva') {
                state.commercial.currentDisciplineIndex = state.commercial.selectedDisciplines.length - 1;
                switchScreen('commercial-wizard');
                showWizardStep();
            } else if (state.commercial.mode === 'rondas') {
                switchScreen('commercial-rounds');
            } else {
                switchScreen('commercial-migration');
            }
        });
    }

    // ==========================================
    // RONDAS LISTENERS
    // ==========================================
    const btnBackRounds = document.getElementById('btn-back-rounds');
    if (btnBackRounds) {
        btnBackRounds.addEventListener('click', () => switchScreen('commercial-client-details'));
    }
    const btnBackRoundsClient = document.getElementById('btn-back-rounds-client');
    if (btnBackRoundsClient) {
        btnBackRoundsClient.addEventListener('click', () => switchScreen('commercial-client-details'));
    }
    const btnRoundsAddPoint = document.getElementById('btn-rounds-add-point');
    if (btnRoundsAddPoint) {
        btnRoundsAddPoint.addEventListener('click', addRoundPoint);
    }
    const inputRoundsKm = document.getElementById('input-rounds-km');
    if (inputRoundsKm) {
        inputRoundsKm.addEventListener('input', calculateRoundsCost);
    }
    const inputRoundsTravelTime = document.getElementById('input-rounds-travel-time');
    if (inputRoundsTravelTime) {
        inputRoundsTravelTime.addEventListener('input', calculateRoundsCost);
    }
    const roundsForm = document.getElementById('rounds-form');
    if (roundsForm) {
        roundsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            state.commercial.rounds.travelKm = parseFloat(document.getElementById('input-rounds-km').value) || 0;
            state.commercial.rounds.travelTime = parseInt(document.getElementById('input-rounds-travel-time').value) || 0;
            generateSummary();
            switchScreen('commercial-summary');
        });
    }

    // Commercial History Listeners
    const btnCommHistory = document.getElementById("btn-commercial-history");
    if (btnCommHistory) {
        btnCommHistory.addEventListener("click", () => switchScreen("commercial-history"));
    }
    const btnBackCommHistory = document.getElementById("btn-back-commercial-history");
    if (btnBackCommHistory) {
        btnBackCommHistory.addEventListener("click", () => switchScreen("commercial-home"));
    }
    const searchCommHistory = document.getElementById("search-commercial-history");
    if (searchCommHistory) {
        searchCommHistory.addEventListener("input", debounce(renderCommercialHistory));
    }
    const btnSaveCommHistory = document.getElementById("btn-save-commercial-history");
    if (btnSaveCommHistory) {
        btnSaveCommHistory.addEventListener("click", saveCommercialReportToHistory);
    }
    const btnSharePdf = document.getElementById('btn-share-pdf');
    if (btnSharePdf) {
        btnSharePdf.addEventListener('click', handlePdfGenerationAndSharing);
    }

    // ==========================================
    // VACATION LISTENERS v1.14.00
    // ==========================================
    const menuVac = document.getElementById("menu-vacations");
    if (menuVac) {
        menuVac.addEventListener("click", () => switchScreen("vacations"));
    }
    const btnBackVac = document.getElementById("btn-back-vacations");
    if (btnBackVac) {
        btnBackVac.addEventListener("click", () => switchScreen("dashboard"));
    }
    const btnVacPrev = document.getElementById("btn-vac-prev-month");
    if (btnVacPrev) {
        btnVacPrev.addEventListener("click", () => navigateVacMonth(-1));
    }
    const btnVacNext = document.getElementById("btn-vac-next-month");
    if (btnVacNext) {
        btnVacNext.addEventListener("click", () => navigateVacMonth(1));
    }
    const btnVacShowForm = document.getElementById("btn-vac-show-request-form");
    if (btnVacShowForm) {
        btnVacShowForm.addEventListener("click", toggleVacationRequestForm);
    }
    const btnVacCancelForm = document.getElementById("btn-vac-cancel-request");
    if (btnVacCancelForm) {
        btnVacCancelForm.addEventListener("click", () => {
            document.getElementById("vacations-request-card").style.display = "none";
            state.vacation.editingId = null;
            updateVacationCounter();
        });
    }
    const formVacReq = document.getElementById("form-vacation-request");
    if (formVacReq) {
        formVacReq.addEventListener("submit", submitVacationRequest);
    }
    const vacTechSelect = document.getElementById("vac-tech-select");
    if (vacTechSelect) {
        vacTechSelect.addEventListener("change", (e) => {
            updateVacationCounter(e.target.value);
        });
    }
    const btnMonthly = document.getElementById("btn-vac-view-monthly");
    const btnYearly = document.getElementById("btn-vac-view-yearly");
    if (btnMonthly && btnYearly) {
        btnMonthly.addEventListener("click", () => {
            state.vacation.activeView = "monthly";
            btnMonthly.classList.remove("btn-secondary");
            btnYearly.classList.add("btn-secondary");
            renderVacationCalendar();
        });
        btnYearly.addEventListener("click", () => {
            state.vacation.activeView = "yearly";
            btnYearly.classList.remove("btn-secondary");
            btnMonthly.classList.add("btn-secondary");
            renderVacationCalendar();
        });
    }
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
        if (["commercial-home", "commercial-client-details", "commercial-disciplines", "commercial-wizard", "commercial-migration", "commercial-summary", "commercial-rounds"].includes(screenId) && !scopes.includes("commercial")) return;
        if (["expenses-submenu", "hours", "diets", "materials", "form-hour", "form-diet", "form-material", "expenses", "form-expense"].includes(screenId) && !scopes.includes("expenses")) return;
        if (screenId === "vacations" && !scopes.includes("vacations")) return;
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
            (itemScreen === "expenses-submenu" && ["hours", "diets", "materials", "form-hour", "form-diet", "form-material", "expenses", "form-expense"].includes(screenId))) {
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
    if (screenId === "expenses") renderExpenses();
    if (screenId === "commercial-history") renderCommercialHistory();
    if (screenId === "vacations") initVacationsScreen();
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
        if (!state.vault.commercial_reports) state.vault.commercial_reports = [];
        if (!state.vault.vacations) state.vault.vacations = [];
        if (!state.vault.manual_categories) {
            state.vault.manual_categories = ["Ademco", "DSC", "Paradox", "Risco", "Galaxy", "Ajax", "Texecom", "General"];
        }
        
        // Automatic default admin user initialization on first unlock
        if (userCount === 0) {
            state.vault.users = [
                { username: "admin", role: "admin", scope: ["passwords", "subscribers", "manuals", "expenses", "commercial", "vacations"] }
            ];
            const adminWrapped = await encryptData(vaultKey, vaultKey);
            state.usersMetadata["admin"] = adminWrapped;
            state.vault.version = "4.01";
            state.vault.company_name = "ALTA TECNOLOGIA PARA LA SEGURIDAD";
        }
        
        const loggedInUsername = (username || "admin").toLowerCase();
        let activeUser = state.vault.users.find(u => u.username.toLowerCase() === loggedInUsername);
        
        if (!activeUser) {
            activeUser = {
                username: loggedInUsername,
                role: loggedInUsername === "admin" ? "admin" : "viewer",
                scope: loggedInUsername === "admin" ? ["passwords", "subscribers", "manuals", "expenses", "commercial", "vacations"] : []
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
            els.lblCompanyName.textContent = "ALTA TECNOLOGIA PARA LA SEGURIDAD";
            els.setCompanyName.value = "ALTA TECNOLOGIA PARA LA SEGURIDAD";
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
async function syncWithCloud(isRetry = false) {
    if (!state.masterPassword) return;

    if (!state.gitClient) {
        state.gitClient = new GitHubClient(
            GIT_CONFIG.user,
            GIT_CONFIG.repo,
            GIT_CONFIG.token,
            GIT_CONFIG.path
        );
    }

    const showUi = !isRetry;

    if (showUi) {
        showLoading(true, "Cifrando base de datos...");
    }
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
        if (showUi) {
            showLoading(true, "Comprobando cambios en GitHub...");
        }
        const remoteFile = await state.gitClient.fetchFile();
        
        let targetSha = state.gitSha;
        if (remoteFile) {
            if (!state.gitSha || remoteFile.sha !== state.gitSha) {
                // Conflict check
                if (showUi) {
                    showLoading(false);
                    const overwrite = confirm("Alerta de Sincronización: Se han detectado cambios en GitHub no descargados localmente (o iniciaste sesión sin conexión). ¿Estás seguro de que deseas sobrescribir los datos remotos con tus datos locales?");
                    if (!overwrite) {
                        setSyncStatus(false);
                        showToast("Sincronización cancelada para proteger tus datos");
                        return;
                    }
                } else {
                    // Prevent background overwriting if offline session or conflict
                    console.warn("Conflict detected during background sync. Overwrite prevented.");
                    setSyncStatus(false);
                    return;
                }
            }
            targetSha = remoteFile.sha;
        }

        // 3. Upload/Push encrypted file
        if (showUi) {
            showLoading(true, "Subiendo cambios a GitHub...");
        }
        const newSha = await state.gitClient.saveFile(encryptedStr, targetSha);
        state.gitSha = newSha;

        setSyncStatus(true);
        if (showUi) {
            showToast("¡Base de datos sincronizada con GitHub!");
        }

        // Process any pending offline tasks now that we are successfully online and synced
        queueProcess();
    } catch (error) {
        console.error(error);
        setSyncStatus("error");
        if (showUi) {
            showToast("Error de sincronización: " + error.message);
        }
        
        if (!isRetry) {
            queueAdd("github", {});
        } else {
            throw error;
        }
    } finally {
        if (showUi) {
            showLoading(false);
        }
    }
}

// Lock application and wipe password from memory
function lockVault() {
    state.masterPassword = "";
    state.vault = { version: "1.14.01", company_name: "ALTA TECNOLOGIA PARA LA SEGURIDAD", theme: "default", entries: [], subscribers: [], manuals: [], expenses: [], users: [], vacations: [] };
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
        const typeText = e.tipo.toUpperCase() + (e.tipo_detalle ? ` (${e.tipo_detalle.toUpperCase()})` : '');
        const subtext = `${emoji} ${typeText} • Usuario: ${e.usuario} ${e.address ? '• ' + e.address : ''}`;

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
        else if (e.category === "Otros" || e.category === "Material") emoji = "🛠️";
        
        let detailsText = `${e.concept || "-"}`;
        if (e.category === "Combustible") {
            detailsText += ` [${e.vehicle || "S/M"}] ${e.kilometers ? '• ' + e.kilometers + ' km' : ''}`;
        }
        
        const displayCategory = (e.category === "Material") ? "OTROS" : e.category.toUpperCase();
        const subtext = `${emoji} ${displayCategory} • ${e.date} • Técnico: ${e.user_name || "Móvil"}`;

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
    document.getElementById("sub-type-detail").value = "";

    // Reset password customization controls to default values
    const passRange = document.getElementById("sub-pass-length-range");
    const passRangeVal = document.getElementById("sub-pass-length-val");
    if (passRange && passRangeVal) {
        passRange.value = 6;
        passRangeVal.textContent = 6;
    }
    const optUpper = document.getElementById("sub-opt-upper");
    const optLower = document.getElementById("sub-opt-lower");
    const optNumber = document.getElementById("sub-opt-number");
    const optSymbol = document.getElementById("sub-opt-symbol");
    if (optUpper) optUpper.checked = false;
    if (optLower) optLower.checked = true;
    if (optNumber) optNumber.checked = true;
    if (optSymbol) optSymbol.checked = false;

    if (id) {
        const entry = state.vault.subscribers.find(e => e.id === id);
        if (entry) {
            document.getElementById("subscriber-form-title").textContent = "Editar Abonado";
            document.getElementById("sub-id").value = entry.id;
            document.getElementById("sub-type").value = entry.tipo || "alarm";
            document.getElementById("sub-type-detail").value = entry.tipo_detalle || "";
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
    const tipo_detalle = document.getElementById("sub-type-detail").value.trim();
    const subscriber_code = document.getElementById("sub-code").value.trim();
    const nombre = document.getElementById("sub-name").value.trim();
    const address = document.getElementById("sub-address").value.trim();
    const usuario = document.getElementById("sub-username").value.trim();
    const password = document.getElementById("sub-password").value.trim();

    const entryData = { tipo, tipo_detalle, subscriber_code, nombre, address, usuario, password };

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
    
    // Send Telegram alert asynchronously (non-blocking)
    enviarAlertaTelegram("Abonado", { ...entryData, isNew: !id });
    
    // Send Google Sheets sync asynchronously (non-blocking)
    enviarAlertaGoogleSheets("Abonados", entryData);
    
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
        owner: state.currentUser ? state.currentUser.username : "admin",
        user_name: state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO",
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

    // Send Telegram alert asynchronously (non-blocking)
    enviarAlertaTelegram("Gasto", expenseData);

    // Send Google Sheets sync asynchronously (non-blocking)
    enviarAlertaGoogleSheets("Gastos", expenseData);

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
    showToast("Ajustes y Perfil guardados. Sincronizando...");
    syncWithCloud();
}

// Helper to escape basic Markdown special characters for Telegram API
function escapeMarkdown(text) {
    if (!text) return "";
    return text.toString()
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/`/g, '\\`')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
}

// Add task to offline queue
function queueAdd(type, payload) {
    const queueJson = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    
    // Check if an identical payload already exists in the queue to avoid duplicates
    const payloadStr = JSON.stringify(payload);
    const exists = queue.some(item => item.type === type && JSON.stringify(item.payload) === payloadStr);
    
    if (!exists) {
        queue.push({
            id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            type,
            payload,
            timestamp: Date.now()
        });
        localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
        console.log(`Task added to offline queue (${type})`);
    }
}

// Process pending tasks in the offline queue
async function queueProcess() {
    if (state.isProcessingQueue) return;
    state.isProcessingQueue = true;

    try {
        const queueJson = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
        if (!queueJson) return;
        const queue = JSON.parse(queueJson);
        if (queue.length === 0) return;

        console.log(`Processing offline queue: ${queue.length} items pending.`);
        const remainingQueue = [];
        let networkFailed = false;

        for (const item of queue) {
            if (networkFailed) {
                remainingQueue.push(item);
                continue;
            }

            try {
                if (item.type === "telegram") {
                    await enviarAlertaTelegram(item.payload.tipo, item.payload.datos, true);
                } else if (item.type === "google_sheets") {
                    await enviarAlertaGoogleSheets(item.payload.modulo, item.payload.datos, true);
                } else if (item.type === "github") {
                    await syncWithCloud(true);
                }
                console.log(`Task ${item.id} (${item.type}) processed successfully.`);
            } catch (err) {
                console.warn(`Task ${item.id} of type ${item.type} failed:`, err);
                networkFailed = true;
                remainingQueue.push(item);
            }
        }

        if (remainingQueue.length === 0) {
            localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
            console.log("Offline queue completely processed.");
        } else {
            localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(remainingQueue));
            console.log(`Offline queue processed. ${remainingQueue.length} items remaining.`);
        }
    } catch (e) {
        console.error("Error processing offline queue:", e);
    } finally {
        state.isProcessingQueue = false;
    }
}

// Initialize automated background sync listeners
function inicializarSincronizacionAutomatica() {
    // 1. Process queue when the device goes online
    window.addEventListener("online", () => {
        console.log("Device is online. Processing offline queue...");
        showToast("Conexión restablecida. Sincronizando datos pendientes...");
        queueProcess();
    });

    // 2. Periodically check and process queue if online
    setInterval(() => {
        if (navigator.onLine) {
            queueProcess();
        }
    }, 30000); // Check every 30 seconds

    // 3. Initial check on load
    setTimeout(() => {
        if (navigator.onLine) {
            queueProcess();
        }
    }, 5000);
}

// Reusable function to send alerts to Telegram channel
async function enviarAlertaTelegram(tipo, datos, isRetry = false) {
    if (!TELEGRAM_CONFIG.token || !TELEGRAM_CONFIG.chatId) {
        console.warn("Telegram configurations are missing.");
        return;
    }

    // Format date DD/MM/AAAA HH:MM
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const fechaFormateada = `${dia}/${mes}/${anio} ${horas}:${minutos}`;

    let tipoMsg = "";
    let tecnicoMsg = "";
    let detalleMsg = "";
    let montoMsg = "";

    if (tipo === "Gasto") {
        tipoMsg = escapeMarkdown(`Gasto - ${datos.category}`);
        tecnicoMsg = escapeMarkdown(datos.user_name || "TÉCNICO");
        
        let detail = datos.concept || "-";
        if (datos.category === "Combustible") {
            const locStr = datos.location ? ` @ ${datos.location}` : "";
            detail += ` [Matrícula: ${datos.vehicle || "S/M"}${datos.kilometers ? `, Kms: ${datos.kilometers}` : ""}${locStr}]`;
        }
        detalleMsg = escapeMarkdown(detail);
        montoMsg = escapeMarkdown(`${parseFloat(datos.amount || 0).toFixed(2)} €`);
    } else if (tipo === "Abonado") {
        const spec = datos.tipo_detalle ? ` (${datos.tipo_detalle})` : "";
        tipoMsg = escapeMarkdown(`Abonado - ${datos.tipo.toUpperCase()}${spec}`);
        tecnicoMsg = escapeMarkdown(state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO");
        
        let detail = datos.nombre || "-";
        if (datos.address) {
            detail += ` (${datos.address})`;
        }
        detalleMsg = escapeMarkdown(detail);
        montoMsg = escapeMarkdown(datos.subscriber_code || "Sin número");
    } else if (tipo === "Vacaciones") {
        tipoMsg = escapeMarkdown(`Vacaciones - ${datos.subtipo}`);
        tecnicoMsg = escapeMarkdown(datos.tecnico || "TÉCNICO");
        detalleMsg = escapeMarkdown(datos.detalle || "-");
        montoMsg = escapeMarkdown(datos.estado || "Pendiente");
    }

    let headerTitle = datos.isNew === false ? "*Registro Modificado en ALTA TECNOLOGIA PARA LA SEGURIDAD*" : "*Nuevo Registro en ALTA TECNOLOGIA PARA LA SEGURIDAD*";
    if (tipo === "Vacaciones") {
        headerTitle = datos.subtipo === "Solicitud" ? "*Nueva Solicitud de Vacaciones*" : "*Resolución de Vacaciones*";
    }
    
    const message = `${headerTitle}
• *Tipo:* ${tipoMsg}
• *Técnico:* ${tecnicoMsg}
• *Detalle / Concepto:* ${detalleMsg}
• *Estado / Info:* ${montoMsg}
• *Fecha:* ${fechaFormateada}`;

    const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.token}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CONFIG.chatId,
                text: message,
                parse_mode: "Markdown"
            })
        });

        const result = await response.json();
        if (!response.ok) {
            console.error("Telegram API Error response:", result);
        } else {
            console.log("Telegram notification sent successfully:", result.result?.message_id);
        }
    } catch (err) {
        console.error("Network error sending Telegram notification:", err);
        if (!isRetry) {
            queueAdd("telegram", { tipo, datos });
        } else {
            throw err;
        }
    }
}

// Reusable function to synchronize data with Google Sheets via Webhook
async function enviarAlertaGoogleSheets(modulo, datos, isRetry = false) {
    if (!GOOGLE_CONFIG.webhookUrl || GOOGLE_CONFIG.webhookUrl === "YOUR_GOOGLE_APPS_SCRIPT_WEBHOOK_URL") {
        console.log("Google Sheets Webhook URL is not configured.");
        return;
    }

    const tecnico = state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO";

    const payload = {
        tecnico: tecnico,
        modulo: modulo,
        datos: datos
    };

    try {
        const response = await fetch(GOOGLE_CONFIG.webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            },
            body: JSON.stringify(payload)
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const result = await response.json();
            if (result.status === "success") {
                console.log("Google Sheets sync successful:", result.message);
            } else {
                console.error("Google Sheets sync returned error status:", result.message);
            }
        } else {
            const textResponse = await response.text();
            console.log("Google Sheets sync raw response (non-JSON):", textResponse);
        }
    } catch (err) {
        console.error("Network or parsing error syncing with Google Sheets:", err);
        if (!isRetry) {
            queueAdd("google_sheets", { modulo, datos });
        } else {
            throw err;
        }
    }
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

function generateCustomPassword(length = 6, options = {}) {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=";

    let pool = "";
    if (options.upper) pool += uppercase;
    if (options.lower) pool += lowercase;
    if (options.number) pool += numbers;
    if (options.symbol) pool += symbols;

    // Fallback if none selected
    if (!pool) pool = lowercase + numbers;

    let password = "";
    for (let i = 0; i < length; i++) {
        password += pool.charAt(Math.floor(Math.random() * pool.length));
    }
    return password;
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
        if (loginSubtitle) loginSubtitle.textContent = "Introduce tus credenciales para acceder a ALTA TECNOLOGIA PARA LA SEGURIDAD.";
        if (loginPassInput) loginPassInput.placeholder = "Contraseña";
    } else {
        if (usernameGroup) usernameGroup.style.display = "none";
        if (loginSubtitle) loginSubtitle.textContent = "Introduce tu Clave Maestra para descifrar la base de datos de ALTA TECNOLOGIA PARA LA SEGURIDAD.";
        if (loginPassInput) loginPassInput.placeholder = "Clave Maestra";
    }
}

// Apply role and scope privileges in the UI
function applyUserPrivileges(user) {
    // Set role attribute for CSS hiding rules (viewer vs editor/admin)
    document.getElementById("app-container").setAttribute("data-role", user.role);
    
    // Update UI profile display in Settings
    document.getElementById("set-current-username").textContent = user.username.toUpperCase();
    
    const roleLabels = {
        admin: "Administrador",
        editor: "Técnico",
        responsable_tecnico: "Responsable Técnico",
        viewer: "Solo Lectura"
    };
    document.getElementById("set-current-user-role").textContent = `Rol: ${roleLabels[user.role] || user.role.toUpperCase()}`;
    
    // Update profile summary card (read-only)
    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "—";
    };
    setEl("prof-summary-name", user.fullName);
    setEl("prof-summary-zona", user.zona);
    setEl("prof-summary-delegacion", user.delegacion);
    setEl("prof-summary-vehiculo", user.vehiculo);
    setEl("prof-summary-tarjeta", user.tarjeta);
    
    // "Editar mi perfil" button wires to openUserForm with own user object
    const btnEditProfile = document.getElementById("btn-edit-my-profile");
    if (btnEditProfile) {
        btnEditProfile.onclick = () => {
            const self = state.vault.users.find(u => u.username.toLowerCase() === user.username.toLowerCase());
            openUserForm(self || user);
        };
    }
    
    // Admin and Responsable Técnico: show/hide User Management panel
    if (user.role === "admin" || user.role === "responsable_tecnico") {
        document.getElementById("admin-user-panel").style.display = "block";
        renderAdminUsers();
    } else {
        document.getElementById("admin-user-panel").style.display = "none";
    }
    
    // Export tech selector: visible for admin and responsable_tecnico
    const techSelectorWrap = document.getElementById("export-tech-selector-wrap");
    if (techSelectorWrap) {
        if (canSeeAllExpenses(user)) {
            techSelectorWrap.style.display = "block";
            populateExportTechSelector();
        } else {
            techSelectorWrap.style.display = "none";
        }
    }
    
    // Filter Dashboard categories and bottom navigation based on scopes
    const scopes = user.scope || [];
    const hasPass = scopes.includes("passwords") || user.role === "admin";
    const hasSubs = scopes.includes("subscribers") || user.role === "admin";
    const hasManuals = scopes.includes("manuals") || user.role === "admin";
    const hasExpenses = scopes.includes("expenses") || user.role === "admin";
    const hasComm = scopes.includes("commercial") || user.role === "admin";
    const hasVacations = scopes.includes("vacations") || user.role === "admin";
    
    document.getElementById("menu-passwords").style.display = hasPass ? "flex" : "none";
    
    document.getElementById("menu-subscribers").style.display = hasSubs ? "flex" : "none";
    document.querySelector('nav [data-screen="subscribers"]').style.display = hasSubs ? "flex" : "none";
    
    document.getElementById("menu-manuals").style.display = hasManuals ? "flex" : "none";
    
    document.getElementById("menu-expenses").style.display = hasExpenses ? "flex" : "none";
    document.querySelector('nav [data-screen="expenses-submenu"]').style.display = hasExpenses ? "flex" : "none";
    
    const menuComm = document.getElementById("menu-commercial");
    if (menuComm) {
        menuComm.style.display = hasComm ? "flex" : "none";
    }
    
    document.getElementById("menu-vacations").style.display = hasVacations ? "flex" : "none";
    document.querySelector('nav [data-screen="vacations"]').style.display = hasVacations ? "flex" : "none";

    // Update vacation badge
    updateVacationBadge();
}

// Helper: returns true if user can see all technicians' expenses
function canSeeAllExpenses(user) {
    return user && (user.role === "admin" || user.role === "responsable_tecnico");
}

// Helper: check if a record belongs to a specific user (handles legacy logs without owner property)
function isOwnerOf(entry, user) {
    if (!user) return false;
    const me = user.username.toLowerCase();
    if (entry.owner) {
        return entry.owner.toLowerCase() === me;
    }
    // Legacy fallback (no owner field): try to match by user_name
    if (entry.user_name) {
        const uName = entry.user_name.toLowerCase();
        const myFullName = user.fullName ? user.fullName.toLowerCase() : null;
        const myUpperName = user.username.toUpperCase();
        return uName === me || uName === myFullName || entry.user_name === myUpperName;
    }
    return false;
}

// Populate export tech selector with all users that have expense records
function populateExportTechSelector() {
    const sel = document.getElementById("export-tech-select");
    if (!sel) return;
    sel.innerHTML = '<option value="all">— Todos los técnicos —</option>';
    const users = state.vault.users || [];
    users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.username;
        opt.textContent = (u.fullName || u.username.toUpperCase()) + " (" + u.username + ")";
        sel.appendChild(opt);
    });
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
    
    // Disable role and scope fields if the current user is not admin and not responsable_tecnico
    const canManageRoles = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    roleSelect.disabled = !canManageRoles;
    document.getElementById("user-scope-passwords").disabled = !canManageRoles;
    document.getElementById("user-scope-subscribers").disabled = !canManageRoles;
    document.getElementById("user-scope-manuals").disabled = !canManageRoles;
    document.getElementById("user-scope-expenses").disabled = !canManageRoles;
    document.getElementById("user-scope-commercial").disabled = !canManageRoles;
    document.getElementById("user-scope-vacations").disabled = !canManageRoles;
    
    if (u) {
        title.textContent = "Editar Usuario";
        nameInput.value = u.username;
        nameInput.disabled = true;
        passInput.placeholder = "Dejar en blanco para mantener contraseña";
        passInput.required = false;
        roleSelect.value = u.role;
        editId.value = u.username;
        
        document.getElementById("user-scope-passwords").checked = u.scope ? u.scope.includes("passwords") : true;
        document.getElementById("user-scope-subscribers").checked = u.scope ? u.scope.includes("subscribers") : true;
        document.getElementById("user-scope-manuals").checked = u.scope ? u.scope.includes("manuals") : true;
        document.getElementById("user-scope-expenses").checked = u.scope ? u.scope.includes("expenses") : true;
        document.getElementById("user-scope-commercial").checked = u.scope ? u.scope.includes("commercial") : true;
        document.getElementById("user-scope-vacations").checked = u.scope ? u.scope.includes("vacations") : true;
        
        // Profile fields
        document.getElementById("user-profile-fullname").value = u.fullName || "";
        document.getElementById("user-profile-zona").value = u.zona || "";
        document.getElementById("user-profile-delegacion").value = u.delegacion || "";
        document.getElementById("user-profile-vehiculo").value = u.vehiculo || "";
        document.getElementById("user-profile-tarjeta").value = u.tarjeta || "";
        document.getElementById("user-profile-hiredate").value = u.hireDate || "";
    } else {
        title.textContent = "Nuevo Usuario";
        nameInput.value = "";
        nameInput.disabled = false;
        passInput.placeholder = "Contraseña de acceso";
        passInput.required = true;
        roleSelect.value = "editor";
        editId.value = "";
        
        document.getElementById("user-scope-passwords").checked = true;
        document.getElementById("user-scope-subscribers").checked = true;
        document.getElementById("user-scope-manuals").checked = true;
        document.getElementById("user-scope-expenses").checked = true;
        document.getElementById("user-scope-commercial").checked = true;
        document.getElementById("user-scope-vacations").checked = true;
        
        // Clear profile fields
        document.getElementById("user-profile-fullname").value = "";
        document.getElementById("user-profile-zona").value = "";
        document.getElementById("user-profile-delegacion").value = "";
        document.getElementById("user-profile-vehiculo").value = "";
        document.getElementById("user-profile-tarjeta").value = "";
        document.getElementById("user-profile-hiredate").value = "";
    }
    
    switchScreen("form-user");
}

// User Administration: Form Submission Save
async function saveUserAction(evt) {
    evt.preventDefault();
    const canManageRoles = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    
    if (!canManageRoles) {
        // Allow a user to edit their own profile
        const editId = document.getElementById("user-edit-id").value;
        if (!editId || editId.toLowerCase() !== state.currentUser.username.toLowerCase()) {
            showToast("Operación no permitida");
            return;
        }
    }
    
    const editId = document.getElementById("user-edit-id").value;
    const username = document.getElementById("user-name-input").value.trim().toLowerCase();
    const password = document.getElementById("user-pass-input").value.trim();
    const role = document.getElementById("user-role-select").value;
    
    const scope = [];
    if (document.getElementById("user-scope-passwords").checked) scope.push("passwords");
    if (document.getElementById("user-scope-subscribers").checked) scope.push("subscribers");
    if (document.getElementById("user-scope-manuals").checked) scope.push("manuals");
    if (document.getElementById("user-scope-expenses").checked) scope.push("expenses");
    if (document.getElementById("user-scope-commercial").checked) scope.push("commercial");
    if (document.getElementById("user-scope-vacations").checked) scope.push("vacations");
    
    // Profile fields
    const fullName = document.getElementById("user-profile-fullname").value.trim();
    const zona = document.getElementById("user-profile-zona").value.trim();
    const delegacion = document.getElementById("user-profile-delegacion").value.trim();
    const vehiculo = document.getElementById("user-profile-vehiculo").value.trim();
    const tarjeta = document.getElementById("user-profile-tarjeta").value.trim();
    const hireDate = document.getElementById("user-profile-hiredate").value;
    
    if (!username) {
        showToast("Escribe un nombre de usuario");
        return;
    }
    
    showLoading(true, "Guardando usuario...");
    
    try {
        if (editId) {
            const idx = state.vault.users.findIndex(u => u.username.toLowerCase() === editId.toLowerCase());
            if (idx !== -1) {
                // Only admin and responsable_tecnico can change role/scope
                if (canManageRoles) {
                    state.vault.users[idx].role = role;
                    state.vault.users[idx].scope = scope;
                }
                // Any user can update own profile fields
                state.vault.users[idx].fullName = fullName;
                state.vault.users[idx].zona = zona;
                state.vault.users[idx].delegacion = delegacion;
                state.vault.users[idx].vehiculo = vehiculo;
                state.vault.users[idx].tarjeta = tarjeta;
                state.vault.users[idx].hireDate = hireDate;
                
                if (password) {
                    const wrappedKey = await encryptData(state.masterPassword, password);
                    state.usersMetadata[editId.toLowerCase()] = wrappedKey;
                }
                
                // Update currentUser in state if editing own profile
                if (editId.toLowerCase() === state.currentUser.username.toLowerCase()) {
                    state.currentUser = { ...state.currentUser, fullName, zona, delegacion, vehiculo, tarjeta, hireDate };
                    applyUserPrivileges(state.currentUser);
                }
            }
        } else {
            if (state.vault.users.some(u => u.username.toLowerCase() === username)) {
                showLoading(false);
                showToast("El usuario ya existe");
                return;
            }
            
            state.vault.users.push({ username, role, scope, fullName, zona, delegacion, vehiculo, tarjeta, hireDate });
            
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
    const canManage = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    if (!canManage) return;
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
    
    let typeText = (sub.tipo || "alarm").toUpperCase();
    if (sub.tipo_detalle) {
        typeText += ` - ${sub.tipo_detalle.toUpperCase()}`;
    }
    document.getElementById("sub-view-type").textContent = typeText;
    
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
    document.getElementById("hour-client").value = "";
    
    if (id) {
        const entry = state.vault.hours.find(h => h.id === id);
        if (entry) {
            document.getElementById("hour-form-title").textContent = "Editar Horas Extras";
            document.getElementById("hour-id").value = entry.id;
            document.getElementById("hour-date").value = entry.date || "";
            document.getElementById("hour-concept").value = entry.concept || "TRABAJOS";
            document.getElementById("hour-client").value = entry.client || "";
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
    const client = document.getElementById("hour-client").value.trim();
    const description = document.getElementById("hour-description").value.trim();
    const startTime = document.getElementById("hour-start").value;
    const endTime = document.getElementById("hour-end").value;
    
    // Calculate duration
    const hours = calculateTimeDiff(startTime, endTime);
    
    const entryData = {
        date,
        concept,
        client,
        description,
        startTime,
        endTime,
        hours,
        owner: state.currentUser ? state.currentUser.username : "admin",
        user_name: state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO"
    };
    
    if (id) {
        const idx = state.vault.hours.findIndex(h => h.id == id);
        if (idx !== -1) {
            // Preserve owner if already set
            const existingOwner = state.vault.hours[idx].owner;
            state.vault.hours[idx] = { ...state.vault.hours[idx], ...entryData };
            if (existingOwner) state.vault.hours[idx].owner = existingOwner;
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
    
    // Isolation: technicians only see their own records
    if (!canSeeAllExpenses(state.currentUser)) {
        filtered = filtered.filter(h => isOwnerOf(h, state.currentUser));
    }
    
    if (q) {
        filtered = filtered.filter(h => {
            return (h.description || "").toLowerCase().includes(q) || 
                   (h.concept || "").toLowerCase().includes(q) ||
                   (h.client || "").toLowerCase().includes(q) ||
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
        
        const titleText = `${h.client || "Sin cliente"}`;
        const descText = h.description ? ` • ${h.description}` : '';
        const subtext = `⏱️ ${h.date} • ${h.startTime} a ${h.endTime} (${h.hours.substring(0, 5)} hrs)${descText} • ${h.user_name}`;
        
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
        owner: state.currentUser ? state.currentUser.username : "admin",
        user_name: state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO"
    };
    
    if (id) {
        const idx = state.vault.diets.findIndex(d => d.id == id);
        if (idx !== -1) {
            const existingOwner = state.vault.diets[idx].owner;
            state.vault.diets[idx] = { ...state.vault.diets[idx], ...entryData };
            if (existingOwner) state.vault.diets[idx].owner = existingOwner;
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
    
    // Isolation: technicians only see their own records
    if (!canSeeAllExpenses(state.currentUser)) {
        filtered = filtered.filter(d => isOwnerOf(d, state.currentUser));
    }
    
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

// OTROS GASTOS CRUD
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
            document.getElementById("material-form-title").textContent = "Editar Otro Gasto";
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
        document.getElementById("material-form-title").textContent = "Registrar Otro Gasto";
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
        owner: state.currentUser ? state.currentUser.username : "admin",
        user_name: state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO"
    };
    
    if (id) {
        const idx = state.vault.materials.findIndex(m => m.id == id);
        if (idx !== -1) {
            const existingOwner = state.vault.materials[idx].owner;
            state.vault.materials[idx] = { ...state.vault.materials[idx], ...entryData };
            if (existingOwner) state.vault.materials[idx].owner = existingOwner;
        }
    } else {
        entryData.id = Date.now();
        state.vault.materials.unshift(entryData);
    }
    
    setSyncStatus(false);
    switchScreen("materials");
    showToast("Registro guardado localmente");
    await syncWithCloud();
}

async function deleteMaterialEntry(id) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    if (confirm("¿Eliminar este registro de gasto?")) {
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
    
    // Isolation: technicians only see their own records
    if (!canSeeAllExpenses(state.currentUser)) {
        filtered = filtered.filter(m => isOwnerOf(m, state.currentUser));
    }
    
    if (q) {
        filtered = filtered.filter(m => {
            return (m.client || "").toLowerCase().includes(q) || 
                   (m.concept || "").toLowerCase().includes(q) ||
                   (m.date || "").includes(q);
        });
    }
    
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary); font-size:0.9rem;">No hay registros de otros gastos</div>`;
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
    
    const filterPrefix = `${year}-${month}`;
    
    const company = "ALTA TECNOLOGIA PARA LA SEGURIDAD";
    const monthName = getSpanishMonthName(month);
    const logoUrl = state.commercial.logoBase64 || 'logo.png';
    
    // Determine which technician's data to export
    let targetOwner = null; // null = current user (self), 'all' = everyone
    let exportUser = state.currentUser;
    
    if (canSeeAllExpenses(state.currentUser)) {
        const sel = document.getElementById("export-tech-select");
        const selected = sel ? sel.value : "all";
        if (selected === "all") {
            targetOwner = "all";
            // Use generic label
            exportUser = { fullName: "Todos los Técnicos", zona: "", delegacion: "", vehiculo: "", tarjeta: "" };
        } else {
            targetOwner = selected;
            const found = (state.vault.users || []).find(u => u.username === selected);
            exportUser = found || state.currentUser;
        }
    } else {
        targetOwner = state.currentUser ? state.currentUser.username : null;
    }
    
    const userFullName = exportUser ? (exportUser.fullName || (exportUser.username || "").toUpperCase()) : "TÉCNICO";
    const zona = exportUser ? (exportUser.zona || "-") : "-";
    const delegacion = exportUser ? (exportUser.delegacion || "-") : "-";
    const vehiculo = exportUser ? (exportUser.vehiculo || "-") : "-";
    const tarjeta = exportUser ? (exportUser.tarjeta || "-") : "-";
    
    // Owner filter helper
    const ownerMatch = (entry) => {
        if (targetOwner === "all") return true;
        if (canSeeAllExpenses(state.currentUser)) {
            // Admin/responsable exporting a specific user
            const targetUserObj = (state.vault.users || []).find(u => u.username.toLowerCase() === targetOwner.toLowerCase());
            return isOwnerOf(entry, targetUserObj || { username: targetOwner });
        } else {
            // Technician exporting their own
            return isOwnerOf(entry, state.currentUser);
        }
    };

    // Helper to generate pdf with html2pdf.js
    const generatePdfFile = (htmlContent, fileName, downloadOnly = true) => {
        const opt = {
            margin:       10, // Standard 10mm margins
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, scrollY: 0, scrollX: 0, windowWidth: 720 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 700px width corresponds exactly to the ~190mm printable width of an A4 page (with 10mm margins on a 210mm A4 page)
        const contentWithWidth = `<div style="width: 700px; color: #000; background: #fff; font-family: Arial, sans-serif; padding: 10px; box-sizing: border-box;">${htmlContent}</div>`;

        html2pdf().set(opt).from(contentWithWidth).save().catch(err => {
            console.error("PDF Generation error", err);
            showToast("Error al generar PDF");
        });
    };

    const isAllTechs = targetOwner === "all";

    if (type === "hours") {
        // Filter hours by date prefix AND owner
        const items = (state.vault.hours || []).filter(h => (h.date || "").startsWith(filterPrefix) && ownerMatch(h));
        items.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        const totalSumStr = sumTotalHours(items.map(item => item.hours));
        
        let rowsHtml = "";
        const maxRows = Math.max(15, items.length);
        for (let i = 0; i < maxRows; i++) {
            const h = items[i];
            if (h) {
                const parts = h.date.split("-");
                const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                rowsHtml += `
                    <tr>
                        <td style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem;">${formattedDate}</td>
                        ${isAllTechs ? `<td style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem;">${h.user_name}</td>` : ''}
                        <td style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem;">${h.concept || "TRABAJOS"}</td>
                        <td style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem;">${h.client || ""}</td>
                        <td style="border: 1.5px solid #000; padding: 9px; text-align: left; padding-left: 15px; font-size: 0.9rem;">${h.description || ""}</td>
                        <td style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem;">${h.hours}</td>
                    </tr>
                `;
            } else {
                rowsHtml += `
                    <tr>
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                        ${isAllTechs ? `<td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>` : ''}
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                    </tr>
                `;
            }
        }

        const reportHtml = `
            <div style="font-family: Arial, sans-serif; color: #000; padding: 10px;">
                <div style="display: flex; align-items: center; border: 2.5px solid #000; margin-bottom: 25px;">
                    <div style="flex: 1; text-align: center; font-size: 1.4rem; font-weight: 800; padding: 12px; border-right: 2.5px solid #000; letter-spacing: 0.5px;">HORAS EXTRAS</div>
                    <div style="width: 180px; text-align: center; font-size: 1.3rem; font-weight: 800; padding: 12px; background: #f8fafc;">${monthName}</div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 0.95rem; line-height: 1.8;">
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 8px;"><span style="font-weight: 700; width: 80px;">EMPRESA:</span><span style="border-bottom: 1.5px solid #000; flex: 1; font-weight: 600; padding-left: 5px;">${company.toUpperCase()}</span></div>
                        <div style="display: flex; gap: 8px; margin-top:10px"><span style="font-weight: 700; width: 80px;">NOMBRE:</span><span style="border-bottom: 1.5px solid #000; flex: 1; font-weight: 600; padding-left: 5px;">${userFullName}</span></div>
                    </div>
                    <div style="text-align: right;"><img src="${logoUrl}" alt="Logo" style="height: 50px;" onerror="this.style.display='none'"></div>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr>
                            <th style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem; background: #f1f5f9; font-weight: 700; width:12%">FECHA</th>
                            ${isAllTechs ? '<th style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem; background: #f1f5f9; font-weight: 700; width:15%">TÉCNICO</th>' : ''}
                            <th style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem; background: #f1f5f9; font-weight: 700; width:15%">CONCEPTO</th>
                            <th style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem; background: #f1f5f9; font-weight: 700; width:20%">CLIENTE</th>
                            <th style="border: 1.5px solid #000; padding: 9px; text-align: left; padding-left: 15px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700;">MOTIVO / DESCRIPCIÓN</th>
                            <th style="border: 1.5px solid #000; padding: 9px; text-align: center; font-size: 0.9rem; background: #f1f5f9; font-weight: 700; width:15%">TOTAL EXTRAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr style="font-weight: 700; border-top: 2.5px solid #000;">
                            <td colspan="${isAllTechs ? 5 : 4}" style="border: 1.5px solid #000; padding: 9px; text-align: right; padding-right: 15px; background: #ffff00;">TOTAL HORAS</td>
                            <td style="border: 1.5px solid #000; padding: 9px; text-align: center; background: #ffff00;">${totalSumStr}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="margin-top: 50px; font-size: 0.95rem; font-weight: 600;">FIRMA: ${userFullName}</div>
            </div>
        `;
        
        const fileName = `Horas_Extras_${monthName}_${year}_${userFullName.replace(/\s+/g, "_")}.pdf`;

        showExportChoices(
            // Print / PDF download callback
            () => {
                showToast("Generando y descargando PDF...");
                generatePdfFile(reportHtml, fileName);
            },
            // Email callback
            () => {
                showToast("Descargando PDF y preparando email...");
                generatePdfFile(reportHtml, fileName);
                
                const subject = `Horas Extras - ${monthName} ${year} - ${userFullName}`;
                let body = `Hola,\n\nAdjunto a este correo el reporte de HORAS EXTRAS correspondiente a ${monthName} ${year}.\n\n`;
                body += `Detalles del reporte:\n`;
                body += `- Empresa: ${company.toUpperCase()}\n`;
                body += `- Técnico: ${userFullName}\n`;
                body += `- Horas Totales: ${totalSumStr}\n\n`;
                body += `(Nota: El archivo PDF se ha descargado automáticamente en tu dispositivo. Por favor adjúntalo a este correo).`;

                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }
        );
    } else {
        // Consolidated expenses (dietas + materiales/otros + combustible) filtered by owner
        const diets = (state.vault.diets || []).filter(d => (d.date || "").startsWith(filterPrefix) && ownerMatch(d)).map(d => ({
            date: d.date,
            concept: d.concept || "DIETA",
            amount: parseFloat(d.amount) || 0,
            user_name: d.user_name || "TÉCNICO"
        }));
        
        const materials = (state.vault.materials || []).filter(m => (m.date || "").startsWith(filterPrefix) && ownerMatch(m)).map(m => ({
            date: m.date,
            concept: m.concept || "OTROS GASTOS",
            amount: parseFloat(m.amount) || 0,
            user_name: m.user_name || "TÉCNICO"
        }));

        const fuel = (state.vault.expenses || []).filter(e => (e.date || "").startsWith(filterPrefix) && e.category === "Combustible" && ownerMatch(e)).map(e => ({
            date: e.date,
            concept: e.concept || "COMBUSTIBLE",
            amount: parseFloat(e.amount) || 0,
            user_name: e.user_name || "TÉCNICO"
        }));
        
        const combined = [...diets, ...materials, ...fuel];
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
                        <td style="border: 1.5px solid #000; padding: 9px; text-align:center; font-size: 0.9rem;">${formattedDate}</td>
                        ${isAllTechs ? `<td style="border: 1.5px solid #000; padding: 9px; text-align:center; font-size: 0.9rem;">${c.user_name}</td>` : ''}
                        <td style="border: 1.5px solid #000; padding: 9px; text-align:left; padding-left:15px; font-size: 0.9rem;">${c.concept.toUpperCase()}</td>
                        <td style="border: 1.5px solid #000; padding: 9px; text-align: right; padding-right: 20px; font-weight: 600; font-size: 0.9rem; width: 22%;">${c.amount.toFixed(2)} €</td>
                    </tr>
                `;
            } else {
                rowsHtml += `
                    <tr>
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                        ${isAllTechs ? `<td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>` : ''}
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                        <td style="border: 1.5px solid #000; padding: 9px;">&nbsp;</td>
                    </tr>
                `;
            }
        }

        const reportHtml = `
            <div style="font-family: Arial, sans-serif; color: #000; padding: 10px;">
                <div style="display: flex; align-items: center; border: 2.5px solid #000; margin-bottom: 20px;">
                    <div style="padding: 12px; border-right: 2.5px solid #000; text-align: center; width: 140px; display: flex; align-items: center; justify-content: center;"><img src="${logoUrl}" alt="Logo" style="height: 40px;" onerror="this.style.display='none'"></div>
                    <div style="flex: 1; text-align: center; font-size: 1.4rem; font-weight: 800; letter-spacing: 0.5px; padding: 12px; border-right: 2.5px solid #000;">CONTROL DE GASTOS</div>
                    <div style="width: 140px; text-align: center; font-weight: 800; font-size: 1.3rem; padding: 12px; background: #e0f2fe;">GASTOS</div>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                    <tr>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700; width: 130px;">ZONA:</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; text-align: center; font-weight: 700; width:35%">${zona.toUpperCase()}</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700; width: 130px;">MES/AÑO:</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; text-align: center; font-weight: 700;">${monthName}</td>
                    </tr>
                    <tr>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700;">DELEGACION:</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; text-align: center; font-weight: 700;">${delegacion.toUpperCase()}</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700;">AÑO:</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; text-align: center; font-weight: 700;">${year}</td>
                    </tr>
                    <tr>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700;">TARJETA Nº:</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; text-align: center; font-weight: 700;">${tarjeta.toUpperCase()}</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700;" rowspan="2">CONDUCTOR:</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; text-align: center; font-weight: 700; vertical-align:middle" rowspan="2">${userFullName}</td>
                    </tr>
                    <tr>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; font-weight: 700;">VEHICULO:</td>
                        <td style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; text-align: center; font-weight: 700;">${vehiculo.toUpperCase()}</td>
                    </tr>
                </table>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; text-align: center; font-weight: 700; width:15%">DIA</th>
                            ${isAllTechs ? '<th style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; text-align: center; font-weight: 700; width:20%">TÉCNICO</th>' : ''}
                            <th style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; text-align: left; padding-left:15px; font-weight: 700;">CONCEPTO</th>
                            <th style="border: 1.5px solid #000; padding: 9px; font-size: 0.9rem; background: #f1f5f9; text-align: center; font-weight: 700; width:22%">IMPORTE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr style="font-weight: 800; font-size: 0.95rem; border-top: 2.5px solid #000;">
                            <td colspan="${isAllTechs ? 3 : 2}" style="border: 1.5px solid #000; padding: 9px; text-align:right; padding-right:15px;">TOTAL</td>
                            <td style="border: 1.5px solid #000; padding: 9px; text-align: right; padding-right: 20px; background:#f8fafc;">${totalSum.toFixed(2)} €</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        const fileName = `Control_Gastos_${monthName}_${year}_${userFullName.replace(/\s+/g, "_")}.pdf`;

        showExportChoices(
            // Print / PDF download callback
            () => {
                showToast("Generando y descargando PDF...");
                generatePdfFile(reportHtml, fileName);
            },
            // Email callback
            () => {
                showToast("Descargando PDF y preparando email...");
                generatePdfFile(reportHtml, fileName);
                
                const subject = `Control de Gastos - ${monthName} ${year} - ${userFullName}`;
                let body = `Hola,\n\nAdjunto a este correo el reporte de CONTROL DE GASTOS correspondiente a ${monthName} ${year}.\n\n`;
                body += `Detalles del reporte:\n`;
                body += `- Conductor: ${userFullName}\n`;
                body += `- Zona / Delegación: ${zona} / ${delegacion}\n`;
                body += `- Importe Total: ${totalSum.toFixed(2)} €\n\n`;
                body += `(Nota: El archivo PDF se ha descargado automáticamente en tu dispositivo. Por favor adjúntalo a este correo).`;

                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }
        );
    }
}

// Dialog helper to select print vs email
function showExportChoices(onPrint, onEmail) {
    const dialog = document.createElement("div");
    dialog.style.position = "fixed";
    dialog.style.top = "0";
    dialog.style.left = "0";
    dialog.style.width = "100%";
    dialog.style.height = "100%";
    dialog.style.backgroundColor = "rgba(0,0,0,0.85)";
    dialog.style.zIndex = "1000";
    dialog.style.display = "flex";
    dialog.style.justifyContent = "center";
    dialog.style.alignItems = "center";
    dialog.style.fontFamily = "var(--font-sans, sans-serif)";
    dialog.className = "anim-fade";

    dialog.innerHTML = `
        <div style="background: var(--bg-secondary, #1e293b); border: 1px solid var(--border-glass, rgba(255,255,255,0.1)); border-radius: var(--radius-md, 12px); padding: 25px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            <h3 style="margin-top: 0; margin-bottom: 15px; color: var(--text-primary, #f8fafc); font-size: 1.15rem;">Exportar Reporte</h3>
            <p style="color: var(--text-secondary, #94a3b8); font-size: 0.9rem; margin-bottom: 25px;">Selecciona cómo deseas procesar este reporte mensual.</p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button id="choice-print" class="btn-premium" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="bx bx-printer"></i> IMPRIMIR / PDF
                </button>
                <button id="choice-email" class="btn-premium btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-glass, rgba(255,255,255,0.1)); color: #f8fafc;">
                    <i class="bx bx-envelope"></i> ENVIAR POR EMAIL
                </button>
                <button id="choice-cancel" style="background: transparent; border: none; color: var(--text-secondary, #94a3b8); font-size: 0.85rem; margin-top: 10px; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector("#choice-print").addEventListener("click", () => {
        document.body.removeChild(dialog);
        onPrint();
    });

    dialog.querySelector("#choice-email").addEventListener("click", () => {
        document.body.removeChild(dialog);
        onEmail();
    });

    dialog.querySelector("#choice-cancel").addEventListener("click", () => {
        document.body.removeChild(dialog);
    });
}

// Register Service Worker for PWA offline capabilities
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js")
            .then(reg => console.log("Service Worker registered successfully:", reg.scope))
            .catch(err => console.log("Service Worker registration failed:", err));
    });
}

// ==========================================
// TECHNICAL COMMERCIAL APP (PREVENTA) LOGIC
// ==========================================

function loadLogoAsBase64() {
    fetch('logo.png')
        .then(res => {
            if (!res.ok) throw new Error('Logo image file not found');
            return res.blob();
        })
        .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
                state.commercial.logoBase64 = reader.result;
            };
            reader.readAsDataURL(blob);
        })
        .catch(err => console.warn('Could not pre-load logo image:', err));
}

function processAndCompressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 600; // max width for PDF space efficiency
                let w = img.width;
                let h = img.height;
                
                if (w > maxW) {
                    h = Math.round((maxW * h) / w);
                    w = maxW;
                }
                
                canvas.width = w;
                canvas.height = h;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Photo setup and rendering
document.addEventListener("DOMContentLoaded", () => {
    setupCommercialPhotoUploadListeners();
});

function setupCommercialPhotoUploadListeners() {
    const photoInputs = [
        { inputId: 'input-client-blueprint', previewId: 'previews-blueprint', targetArray: () => [] },
        { inputId: 'input-int-photos', previewId: 'previews-intrusion', targetArray: () => state.commercial.intrusion.photos },
        { inputId: 'input-cctv-photos', previewId: 'previews-cctv', targetArray: () => state.commercial.cctv.photos },
        { inputId: 'input-fire-photos', previewId: 'previews-incendios', targetArray: () => state.commercial.incendios.photos },
        { inputId: 'input-gen-photos', previewId: 'previews-general', targetArray: (disp) => {
                if (!state.commercial.generalPhotos[disp]) state.commercial.generalPhotos[disp] = [];
                return state.commercial.generalPhotos[disp];
            }
        },
        { inputId: 'input-mig-photos', previewId: 'previews-migration', targetArray: () => state.commercial.migration.photos }
    ];

    photoInputs.forEach(({ inputId, previewId, targetArray }) => {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            if (inputId === 'input-client-blueprint') {
                try {
                    const compressed = await processAndCompressImage(files[0]);
                    state.commercial.client.blueprintPhoto = compressed;
                    renderCommercialPreviews(previewId, [compressed], true);
                } catch (err) {
                    console.error("Error loading blueprint:", err);
                }
            } else {
                const currentDiscipline = state.commercial.selectedDisciplines[state.commercial.currentDisciplineIndex];
                const arr = inputId === 'input-gen-photos' ? targetArray(currentDiscipline) : targetArray();

                for (let file of files) {
                    try {
                        const compressedBase64 = await processAndCompressImage(file);
                        arr.push(compressedBase64);
                    } catch (err) {
                        console.error("Error compressing image:", err);
                    }
                }
                renderCommercialPreviews(previewId, arr);
            }
            input.value = '';
        });
    });
}

function renderCommercialPreviews(previewContainerId, photosArray, isBlueprint = false) {
    const container = document.getElementById(previewContainerId);
    if (!container) return;
    container.innerHTML = '';

    photosArray.forEach((photoBase64, index) => {
        if (!photoBase64) return;
        const item = document.createElement('div');
        item.className = 'photo-preview-item';
        item.innerHTML = `
            <img src="${photoBase64}">
            <button type="button" class="photo-preview-remove" data-index="${index}">×</button>
        `;

        item.querySelector('.photo-preview-remove').addEventListener('click', () => {
            if (isBlueprint) {
                state.commercial.client.blueprintPhoto = '';
                renderCommercialPreviews(previewContainerId, [], true);
            } else {
                photosArray.splice(index, 1);
                renderCommercialPreviews(previewContainerId, photosArray);
            }
        });
        container.appendChild(item);
    });
}

// Wizard controller
function startWizard() {
    switchScreen('commercial-wizard');
    showWizardStep();
}

function showWizardStep() {
    const currentDiscipline = state.commercial.selectedDisciplines[state.commercial.currentDisciplineIndex];
    
    // Update progress bar
    const progressPercent = ((state.commercial.currentDisciplineIndex) / state.commercial.selectedDisciplines.length) * 100;
    const progressFill = document.getElementById('wizard-progress-fill');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    
    // Update step label
    const stepInfo = document.getElementById('wizard-step-info');
    if (stepInfo) stepInfo.innerText = `Paso ${state.commercial.currentDisciplineIndex + 1} de ${state.commercial.selectedDisciplines.length}`;

    // Hide all dynamic subsections
    document.querySelectorAll('.discipline-section').forEach(sec => sec.classList.remove('active'));

    // Update title and show the correct subsection
    const wizardTitle = document.getElementById('wizard-discipline-title');
    if (currentDiscipline === 'intrusion') {
        if (wizardTitle) wizardTitle.innerText = 'Configuración de Intrusión';
        document.getElementById('section-intrusion').classList.add('active');
        loadIntrusionFields();
    } else if (currentDiscipline === 'cctv') {
        if (wizardTitle) wizardTitle.innerText = 'Configuración de CCTV';
        document.getElementById('section-cctv').classList.add('active');
        loadCctvFields();
    } else if (currentDiscipline === 'incendios') {
        if (wizardTitle) wizardTitle.innerText = 'Configuración de Incendios';
        document.getElementById('section-incendios').classList.add('active');
        loadIncendiosFields();
    } else {
        if (wizardTitle) wizardTitle.innerText = `Detalles de ${capitalize(currentDiscipline)}`;
        const generalSection = document.getElementById('section-general');
        generalSection.classList.add('active');
        document.getElementById('general-discipline-name').innerText = capitalize(currentDiscipline);
        
        // Load general values
        document.getElementById('input-gen-brand').value = state.commercial[currentDiscipline]?.brand || '';
        document.getElementById('textarea-general-details').value = state.commercial[currentDiscipline]?.notes || '';
        renderCommercialPreviews('previews-general', state.commercial.generalPhotos[currentDiscipline] || []);
    }
}

function saveCurrentWizardStepData() {
    const currentDiscipline = state.commercial.selectedDisciplines[state.commercial.currentDisciplineIndex];
    
    if (currentDiscipline === 'intrusion') {
        state.commercial.intrusion.brand = document.getElementById('input-int-brand').value;
        state.commercial.intrusion.grade = document.getElementById('select-int-grade').value;
        state.commercial.intrusion.pirs = parseInt(document.getElementById('input-int-pirs').value) || 0;
        state.commercial.intrusion.contacts = parseInt(document.getElementById('input-int-contacts').value) || 0;
        state.commercial.intrusion.sirens = parseInt(document.getElementById('input-int-sirens').value) || 0;
        state.commercial.intrusion.keypads = parseInt(document.getElementById('input-int-keypads').value) || 0;
        state.commercial.intrusion.cra = document.getElementById('select-int-cra').value;
        state.commercial.intrusion.maintenance = document.getElementById('select-int-maintenance').value;
    } else if (currentDiscipline === 'cctv') {
        state.commercial.cctv.recorderBrand = document.getElementById('input-cctv-recorder-brand').value;
        state.commercial.cctv.cameraBrand = document.getElementById('input-cctv-camera-brand').value;
        state.commercial.cctv.camerasIndoor = parseInt(document.getElementById('input-cctv-indoor').value) || 0;
        state.commercial.cctv.camerasOutdoor = parseInt(document.getElementById('input-cctv-outdoor').value) || 0;
        state.commercial.cctv.tech = document.getElementById('select-cctv-tech').value;
        state.commercial.cctv.storage = parseInt(document.getElementById('input-cctv-storage').value) || 7;
    } else if (currentDiscipline === 'incendios') {
        state.commercial.incendios.brand = document.getElementById('input-fire-brand').value;
        state.commercial.incendios.type = document.getElementById('select-fire-type').value;
        state.commercial.incendios.detectors = parseInt(document.getElementById('input-fire-detectors').value) || 0;
        state.commercial.incendios.callpoints = parseInt(document.getElementById('input-fire-callpoints').value) || 0;
    } else {
        state.commercial[currentDiscipline] = {
            brand: document.getElementById('input-gen-brand').value,
            notes: document.getElementById('textarea-general-details').value
        };
    }
}

function loadIntrusionFields() {
    document.getElementById('input-int-brand').value = state.commercial.intrusion.brand || '';
    document.getElementById('select-int-grade').value = state.commercial.intrusion.grade;
    document.getElementById('input-int-pirs').value = state.commercial.intrusion.pirs || '';
    document.getElementById('input-int-contacts').value = state.commercial.intrusion.contacts || '';
    document.getElementById('input-int-sirens').value = state.commercial.intrusion.sirens || '';
    document.getElementById('input-int-keypads').value = state.commercial.intrusion.keypads || '';
    document.getElementById('select-int-cra').value = state.commercial.intrusion.cra;
    document.getElementById('select-int-maintenance').value = state.commercial.intrusion.maintenance;
    renderCommercialPreviews('previews-intrusion', state.commercial.intrusion.photos);
}

function loadCctvFields() {
    document.getElementById('input-cctv-recorder-brand').value = state.commercial.cctv.recorderBrand || '';
    document.getElementById('input-cctv-camera-brand').value = state.commercial.cctv.cameraBrand || '';
    document.getElementById('input-cctv-indoor').value = state.commercial.cctv.camerasIndoor || '';
    document.getElementById('input-cctv-outdoor').value = state.commercial.cctv.camerasOutdoor || '';
    document.getElementById('select-cctv-tech').value = state.commercial.cctv.tech;
    document.getElementById('input-cctv-storage').value = state.commercial.cctv.storage || '';
    renderCommercialPreviews('previews-cctv', state.commercial.cctv.photos);
}

function loadIncendiosFields() {
    document.getElementById('input-fire-brand').value = state.commercial.incendios.brand || '';
    document.getElementById('select-fire-type').value = state.commercial.incendios.type;
    document.getElementById('input-fire-detectors').value = state.commercial.incendios.detectors || '';
    document.getElementById('input-fire-callpoints').value = state.commercial.incendios.callpoints || '';
    renderCommercialPreviews('previews-incendios', state.commercial.incendios.photos);
}

// Rondas functionality
function renderRoundsForm() {
    // Set travel values if they exist
    document.getElementById('input-rounds-km').value = state.commercial.rounds.travelKm || 0;
    document.getElementById('input-rounds-travel-time').value = state.commercial.rounds.travelTime || 0;
    
    // Clear inputs for adding a point
    document.getElementById('input-rounds-point-name').value = '';
    document.getElementById('input-rounds-point-time').value = 10;
    
    // Render the list of points and recalculate costs
    renderRoundsPointsList();
    calculateRoundsCost();
}

function addRoundPoint() {
    const nameInput = document.getElementById('input-rounds-point-name');
    const timeInput = document.getElementById('input-rounds-point-time');
    
    const name = nameInput.value.trim();
    const time = parseInt(timeInput.value) || 0;
    
    if (!name) {
        showToast('Introduce un nombre para el punto');
        return;
    }
    if (time <= 0) {
        showToast('El tiempo debe ser mayor que 0');
        return;
    }
    
    if (!state.commercial.rounds.points) {
        state.commercial.rounds.points = [];
    }
    
    state.commercial.rounds.points.push({
        id: "pt_" + Date.now() + "_" + Math.floor(Math.random() * 100),
        name: name,
        time: time
    });
    
    nameInput.value = '';
    timeInput.value = 10;
    
    renderRoundsPointsList();
    calculateRoundsCost();
    showToast('Punto añadido');
}

function deleteRoundPoint(pointId) {
    state.commercial.rounds.points = state.commercial.rounds.points.filter(p => p.id !== pointId);
    renderRoundsPointsList();
    calculateRoundsCost();
    showToast('Punto eliminado');
}

function renderRoundsPointsList() {
    const listContainer = document.getElementById('list-rounds-points');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    const points = state.commercial.rounds.points || [];
    
    if (points.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 15px; color: var(--text-secondary); font-size: 0.85rem; border: 1px dashed var(--border-glass); border-radius: var(--radius-sm);">No hay puntos registrados. Añade al menos uno para calcular los tiempos.</div>`;
        return;
    }
    
    points.forEach(p => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.background = 'rgba(255,255,255,0.02)';
        item.style.border = '1px solid var(--border-glass)';
        item.style.borderRadius = 'var(--radius-sm)';
        item.style.padding = '8px 12px';
        item.style.marginBottom = '6px';
        item.style.fontSize = '0.85rem';
        item.className = 'anim-fade';
        
        item.innerHTML = `
            <div>
                <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(p.name)}</span>
                <span style="color:var(--text-secondary); margin-left: 8px;">(${p.time} min)</span>
            </div>
            <button type="button" class="btn-icon" style="color:var(--danger); padding:0; border:none; background:none; cursor:pointer;" title="Eliminar punto">
                <i class="bx bx-trash" style="font-size: 1.1rem;"></i>
            </button>
        `;
        
        item.querySelector('button').addEventListener('click', () => {
            deleteRoundPoint(p.id);
        });
        
        listContainer.appendChild(item);
    });
}

function calculateRoundsCost() {
    const km = parseFloat(document.getElementById('input-rounds-km').value) || 0;
    const travelTime = parseInt(document.getElementById('input-rounds-travel-time').value) || 0;
    
    const points = state.commercial.rounds.points || [];
    const pointsTime = points.reduce((acc, p) => acc + p.time, 0);
    
    const kmCost = km * 0.50;
    const travelCost = travelTime * 1.00;
    const pointsCost = pointsTime * 1.00;
    const totalCost = kmCost + travelCost + pointsCost;
    
    document.getElementById('cost-rounds-km').innerText = kmCost.toFixed(2) + ' €';
    document.getElementById('cost-rounds-travel').innerText = travelCost.toFixed(2) + ' €';
    document.getElementById('cost-rounds-points').innerText = pointsCost.toFixed(2) + ' €';
    document.getElementById('cost-rounds-total').innerText = totalCost.toFixed(2) + ' €';
}

// Inventory table
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    state.commercial.inventory.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>
                <input type="number" class="inventory-input-qty" id="inv-qty-${index}" min="0" value="${item.qty}">
            </td>
            <td>
                <select class="inventory-select" id="inv-status-${index}">
                    <option value="Reutilizar" ${item.status === 'Reutilizar' ? 'selected' : ''}>Reutilizar</option>
                    <option value="Sustituir" ${item.status === 'Sustituir' ? 'selected' : ''}>Sustituir</option>
                    <option value="No aplica" ${item.status === 'No aplica' ? 'selected' : ''}>No aplica</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveInventoryData() {
    state.commercial.inventory.forEach((item, index) => {
        const qtyInput = document.getElementById(`inv-qty-${index}`);
        const statusSelect = document.getElementById(`inv-status-${index}`);
        if (qtyInput && statusSelect) {
            item.qty = parseInt(qtyInput.value) || 0;
            item.status = statusSelect.value;
        }
    });
}

// Summary generation
function generateSummary() {
    const container = document.getElementById('summary-content');
    if (!container) return;
    container.innerHTML = '';

    // 1. Client Card
    let blueprintSection = '';
    if (state.commercial.client.blueprintPhoto) {
        blueprintSection = `
            <div style="margin-top: 10px;">
                <span class="summary-label" style="font-size: 0.8rem; display: block; margin-bottom: 4px;">Plano de la Instalación:</span>
                <div class="summary-photo-thumbnail" style="width: 120px; height: 90px; border-radius: var(--radius-sm);">
                    <img src="${state.commercial.client.blueprintPhoto}" style="width:100%; height:100%; object-fit:cover;">
                </div>
            </div>
        `;
    }

    let clientHtml = `
        <div class="summary-block">
            <div class="summary-header">DATOS DEL CLIENTE</div>
            <div class="summary-item"><span class="summary-label">Nombre/Razón Social:</span> <span class="summary-value">${escapeHtml(state.commercial.client.name)}</span></div>
            <div class="summary-item"><span class="summary-label">Teléfono:</span> <span class="summary-value">${escapeHtml(state.commercial.client.phone)}</span></div>
            <div class="summary-item"><span class="summary-label">Email:</span> <span class="summary-value">${escapeHtml(state.commercial.client.email)}</span></div>
            <div class="summary-item"><span class="summary-label">Dirección:</span> <span class="summary-value">${escapeHtml(state.commercial.client.address)}</span></div>
            ${blueprintSection}
        </div>
    `;
    container.innerHTML += clientHtml;

    // 2. Data Blocks based on Mode
    if (state.commercial.mode === 'nueva') {
        state.commercial.selectedDisciplines.forEach(disp => {
            let blockHtml = '';
            let photos = [];
            
            if (disp === 'intrusion') {
                photos = state.commercial.intrusion.photos;
                blockHtml = `
                    <div class="summary-block">
                        <div class="summary-header">INTRUSIÓN (Normativa Grado ${state.commercial.intrusion.grade})</div>
                        ${state.commercial.intrusion.brand ? `<div class="summary-item"><span class="summary-label">Central Propuesta:</span> <span class="summary-value">${escapeHtml(state.commercial.intrusion.brand)}</span></div>` : ''}
                        <div class="summary-item"><span class="summary-label">Volumétricos (PIR):</span> <span class="summary-value">${state.commercial.intrusion.pirs}</span></div>
                        <div class="summary-item"><span class="summary-label">Contactos Magnéticos:</span> <span class="summary-value">${state.commercial.intrusion.contacts}</span></div>
                        <div class="summary-item"><span class="summary-label">Sirenas:</span> <span class="summary-value">${state.commercial.intrusion.sirens}</span></div>
                        <div class="summary-item"><span class="summary-label">Teclados:</span> <span class="summary-value">${state.commercial.intrusion.keypads}</span></div>
                        <div class="summary-item"><span class="summary-label">Conexión a CRA:</span> <span class="summary-value">${state.commercial.intrusion.cra === 'yes' ? 'Sí' : 'No'}</span></div>
                        <div class="summary-item"><span class="summary-label">Mantenimiento Bidireccional:</span> <span class="summary-value">${state.commercial.intrusion.maintenance === 'yes' ? 'Sí' : 'No'}</span></div>
                        ${renderSummaryPhotos(photos)}
                    </div>
                `;
            } else if (disp === 'cctv') {
                photos = state.commercial.cctv.photos;
                blockHtml = `
                    <div class="summary-block">
                        <div class="summary-header">CCTV (${state.commercial.cctv.tech})</div>
                        ${state.commercial.cctv.recorderBrand ? `<div class="summary-item"><span class="summary-label">Grabador Propuesto:</span> <span class="summary-value">${escapeHtml(state.commercial.cctv.recorderBrand)}</span></div>` : ''}
                        ${state.commercial.cctv.cameraBrand ? `<div class="summary-item"><span class="summary-label">Cámaras Propuestas:</span> <span class="summary-value">${escapeHtml(state.commercial.cctv.cameraBrand)}</span></div>` : ''}
                        <div class="summary-item"><span class="summary-label">Cámaras Interior:</span> <span class="summary-value">${state.commercial.cctv.camerasIndoor}</span></div>
                        <div class="summary-item"><span class="summary-label">Cámaras Exterior:</span> <span class="summary-value">${state.commercial.cctv.camerasOutdoor}</span></div>
                        <div class="summary-item"><span class="summary-label">Grabación estimada:</span> <span class="summary-value">${state.commercial.cctv.storage} días</span></div>
                        ${renderSummaryPhotos(photos)}
                    </div>
                `;
            } else if (disp === 'incendios') {
                photos = state.commercial.incendios.photos;
                blockHtml = `
                    <div class="summary-block">
                        <div class="summary-header">DETECCIÓN DE INCENDIOS (${state.commercial.incendios.type})</div>
                        ${state.commercial.incendios.brand ? `<div class="summary-item"><span class="summary-label">Central Propuesta:</span> <span class="summary-value">${escapeHtml(state.commercial.incendios.brand)}</span></div>` : ''}
                        <div class="summary-item"><span class="summary-label">Detectores:</span> <span class="summary-value">${state.commercial.incendios.detectors}</span></div>
                        <div class="summary-item"><span class="summary-label">Pulsadores manuales:</span> <span class="summary-value">${state.commercial.incendios.callpoints}</span></div>
                        ${renderSummaryPhotos(photos)}
                    </div>
                `;
            } else {
                photos = state.commercial.generalPhotos[disp] || [];
                blockHtml = `
                    <div class="summary-block">
                        <div class="summary-header">${capitalize(disp).replace('_', ' ')}</div>
                        ${state.commercial[disp]?.brand ? `<div class="summary-item"><span class="summary-label">Equipos Propuestos:</span> <span class="summary-value">${escapeHtml(state.commercial[disp].brand)}</span></div>` : ''}
                        <div class="summary-item"><span class="summary-label">Detalles técnicos:</span> <span class="summary-value" style="display: block; width: 100%; margin-top: 5px; text-align: left;">${escapeHtml(state.commercial[disp]?.notes || 'Sin detalles')}</span></div>
                        ${renderSummaryPhotos(photos)}
                    </div>
                `;
            }
            container.innerHTML += blockHtml;
        });
    } else if (state.commercial.mode === 'rondas') {
        const rounds = state.commercial.rounds || { travelTime: 0, travelKm: 0, points: [] };
        const points = rounds.points || [];
        const pointsTime = points.reduce((acc, p) => acc + p.time, 0);
        
        const kmCost = rounds.travelKm * 0.50;
        const travelCost = rounds.travelTime * 1.00;
        const pointsCost = pointsTime * 1.00;
        const totalCost = kmCost + travelCost + pointsCost;
        
        let roundsHtml = `
            <div class="summary-block">
                <div class="summary-header">RONDAS DE VIGILANTES</div>
                <div class="summary-item"><span class="summary-label">Distancia desde Base:</span> <span class="summary-value">${rounds.travelKm.toFixed(1)} km</span></div>
                <div class="summary-item"><span class="summary-label">Tiempo Desplazamiento:</span> <span class="summary-value">${rounds.travelTime} min</span></div>
                <div class="summary-item"><span class="summary-label">Tiempo Total en Puntos:</span> <span class="summary-value">${pointsTime} min</span></div>
            </div>
            
            <div class="summary-block">
                <div class="summary-header">PUNTOS DE CONTROL REGISTRADOS</div>
                <div style="margin-top: 5px;">
                    ${points.map(p => `
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span style="color: var(--text-primary); font-weight:600;">• ${escapeHtml(p.name)}</span>
                            <span style="color: var(--text-secondary);">${p.time} min</span>
                        </div>
                    `).join('') || '<div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 10px;">Sin puntos registrados</div>'}
                </div>
            </div>
            
            <div class="summary-block">
                <div class="summary-header">DESGLOSE DE COSTES DE RONDAS</div>
                <div class="summary-item"><span class="summary-label">Coste Kilómetros (0.50€/km):</span> <span class="summary-value">${kmCost.toFixed(2)} €</span></div>
                <div class="summary-item"><span class="summary-label">Coste Tiempo Desplazamiento (1€/min):</span> <span class="summary-value">${travelCost.toFixed(2)} €</span></div>
                <div class="summary-item"><span class="summary-label">Coste Tiempo Rondas (1€/min):</span> <span class="summary-value">${pointsCost.toFixed(2)} €</span></div>
                <div class="summary-item" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:8px; margin-top:8px; font-weight:bold;"><span class="summary-label" style="color: var(--text-primary); font-size:1rem;">Coste Total del Servicio:</span> <span class="summary-value" style="color: var(--success); font-size:1.1rem;">${totalCost.toFixed(2)} €</span></div>
            </div>
        `;
        container.innerHTML += roundsHtml;
    } else {
        // Migration details
        let migHtml = `
            <div class="summary-block">
                <div class="summary-header">AUDITORÍA TÉCNICA (MIGRACIÓN)</div>
                <div class="summary-item"><span class="summary-label">Central Existente:</span> <span class="summary-value">${escapeHtml(state.commercial.migration.panelModel || 'No especificado')}</span></div>
                <div class="summary-item"><span class="summary-label">Vías de Comunicación:</span> <span class="summary-value">${escapeHtml(state.commercial.migration.comms)}</span></div>
                <div class="summary-item"><span class="summary-label">Estado de Grabador / Cámaras:</span> <span class="summary-value">${escapeHtml(state.commercial.migration.cctvStatus)}</span></div>
                ${state.commercial.migration.notes ? `<div class="summary-item" style="flex-direction: column; align-items: flex-start; gap: 4px;"><span class="summary-label">Notas Adicionales:</span> <span class="summary-value" style="text-align: left;">${escapeHtml(state.commercial.migration.notes)}</span></div>` : ''}
                ${renderSummaryPhotos(state.commercial.migration.photos)}
            </div>
            
            <div class="summary-block">
                <div class="summary-header">INVENTARIO AUDITADO</div>
                <table class="inventory-table" style="margin-top: 5px;">
                    <thead>
                        <tr>
                            <th>Elemento</th>
                            <th>Cant.</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.commercial.inventory.filter(item => item.qty > 0).map(item => `
                            <tr>
                                <td>${escapeHtml(item.name)}</td>
                                <td>${item.qty}</td>
                                <td>${item.status}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Sin elementos registrados</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML += migHtml;
    }
}

function renderSummaryPhotos(photosArray) {
    if (!photosArray || photosArray.length === 0) return '';
    return `
        <div style="margin-top: 10px;">
            <span class="summary-label" style="font-size: 0.8rem; display: block; margin-bottom: 4px;">Fotografías adjuntas (${photosArray.length}):</span>
            <div class="summary-photos-grid">
                ${photosArray.map(p => `
                    <div class="summary-photo-thumbnail">
                        <img src="${p}">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// PDF Generation
async function handlePdfGenerationAndSharing() {
    const btn = document.getElementById('btn-share-pdf');
    const originalHtml = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; animation: spin 1s infinite linear; margin-right: 8px;">🔄</span> Generando...`;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const reportDate = new Date().toLocaleDateString('es-ES');
        const filename = state.commercial.mode === 'nueva' ? 'instalanueva.pdf' : 
                         state.commercial.mode === 'rondas' ? 'informe_rondas.pdf' : 'migracion.pdf';
        const emailSubject = `Informe Técnico Comercial - ${state.commercial.client.name}`;

        let y = 15;

        // Draw corporate logo from base64 if loaded
        if (state.commercial.logoBase64) {
            doc.addImage(state.commercial.logoBase64, 'PNG', 15, 10, 52, 36);
        } else {
            // Fallback text if logo failed to load
            doc.setTextColor(1, 30, 65);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(28);
            doc.text('ATS', 15, 25);
            doc.setFontSize(8.5);
            doc.text('ALTA TECNOLOGÍA PARA LA SEGURIDAD', 15, 32);
        }

        // Header info (Right aligned)
        doc.setTextColor(100, 116, 139);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Versión App: v1.15.00 by JMSYSTEMS`, 195, 16, { align: 'right' });
        
        doc.setFontSize(11);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(209, 10, 36); // Red corporate title
        const typeLabel = state.commercial.mode === 'nueva' ? 'DISEÑO DE INSTALACIÓN NUEVA' : 
                          state.commercial.mode === 'rondas' ? 'RONDAS DE VIGILANCIA Y COSTES' : 'AUDITORÍA Y MIGRACIÓN';
        doc.text(typeLabel, 195, 26, { align: 'right' });
        
        doc.setFontSize(9);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(`Fecha de Informe: ${reportDate}`, 195, 32, { align: 'right' });

        y = 55;

        // Client Block
        doc.setFillColor(245, 248, 250); // light slate background
        doc.rect(15, y, 180, 32, 'F');
        
        doc.setTextColor(1, 30, 65); // Corporate Navy
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('DATOS DEL CLIENTE', 20, y + 6);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`Cliente / Razón Social: ${state.commercial.client.name}`, 20, y + 12);
        doc.text(`Teléfono: ${state.commercial.client.phone}`, 20, y + 17);
        doc.text(`Email: ${state.commercial.client.email}`, 20, y + 22);
        doc.text(`Dirección: ${state.commercial.client.address}`, 20, y + 27);

        y += 37;

        // Embed Client Blueprint Photo if present
        if (state.commercial.client.blueprintPhoto) {
            if (y + 50 > 270) {
                doc.addPage();
                y = 20;
            }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Plano de la Instalación Adjunto:', 20, y);
            y += 4;
            doc.addImage(state.commercial.client.blueprintPhoto, 'JPEG', 20, y, 66, 46);
            y += 52;
        } else {
            y += 5;
        }

        // Dynamic blocks of content
        if (state.commercial.mode === 'nueva') {
            for (let disp of state.commercial.selectedDisciplines) {
                if (y > 240) {
                    doc.addPage();
                    y = 20;
                }

                // Section header
                doc.setFillColor(241, 245, 249);
                doc.rect(15, y, 180, 7, 'F');
                doc.setTextColor(209, 10, 36); // Red section accent
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(10.5);
                const sectionTitleText = disp === 'intrusion' ? `SISTEMA DE INTRUSIÓN (Normativa Grado ${state.commercial.intrusion.grade})` :
                                         disp === 'cctv' ? `SISTEMA DE CCTV (Tecnología ${state.commercial.cctv.tech})` :
                                         disp === 'incendios' ? `SISTEMA DE DETECCIÓN DE INCENDIOS (${state.commercial.incendios.type})` :
                                         `SISTEMA DE ${disp.toUpperCase().replace('_', ' ')}`;
                doc.text(sectionTitleText, 18, y + 5);
                y += 12;

                doc.setTextColor(30, 41, 59);
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(9.5);

                let photos = [];

                if (disp === 'intrusion') {
                    photos = state.commercial.intrusion.photos;
                    if (state.commercial.intrusion.brand) {
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`Central Propuesta: ${state.commercial.intrusion.brand}`, 20, y);
                        doc.setFont('Helvetica', 'normal');
                        y += 6;
                    }
                    doc.text(`• Detectores Volumétricos (PIR): ${state.commercial.intrusion.pirs} uds.`, 20, y);
                    doc.text(`• Contactos Magnéticos de Apertura: ${state.commercial.intrusion.contacts} uds.`, 20, y + 5);
                    doc.text(`• Sirenas de Alerta (Exterior/Interior): ${state.commercial.intrusion.sirens} uds.`, 20, y + 10);
                    doc.text(`• Teclados / Mandos de Control: ${state.commercial.intrusion.keypads} uds.`, 20, y + 15);
                    doc.text(`• Conexión a Central Receptora de Alarmas (CRA): ${state.commercial.intrusion.cra === 'yes' ? 'SÍ' : 'NO'}`, 20, y + 20);
                    doc.text(`• Mantenimiento Presencial y Bidireccional: ${state.commercial.intrusion.maintenance === 'yes' ? 'SÍ' : 'NO'}`, 20, y + 25);
                    y += 31;
                } else if (disp === 'cctv') {
                    photos = state.commercial.cctv.photos;
                    if (state.commercial.cctv.recorderBrand) {
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`Grabador Propuesto: ${state.commercial.cctv.recorderBrand}`, 20, y);
                        doc.setFont('Helvetica', 'normal');
                        y += 6;
                    }
                    if (state.commercial.cctv.cameraBrand) {
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`Cámaras Propuestas: ${state.commercial.cctv.cameraBrand}`, 20, y);
                        doc.setFont('Helvetica', 'normal');
                        y += 6;
                    }
                    doc.text(`• Cámaras para Interior: ${state.commercial.cctv.camerasIndoor} uds.`, 20, y);
                    doc.text(`• Cámaras para Exterior: ${state.commercial.cctv.camerasOutdoor} uds.`, 20, y + 5);
                    doc.text(`• Tecnología de Vídeo: Sistema ${state.commercial.cctv.tech}`, 20, y + 10);
                    doc.text(`• Autonomía de Grabación Estimada: ${state.commercial.cctv.storage} días de histórico continuo.`, 20, y + 15);
                    y += 21;
                } else if (disp === 'incendios') {
                    photos = state.commercial.incendios.photos;
                    if (state.commercial.incendios.brand) {
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`Central Propuesta: ${state.commercial.incendios.brand}`, 20, y);
                        doc.setFont('Helvetica', 'normal');
                        y += 6;
                    }
                    doc.text(`• Clasificación del Sistema: En conformidad con EN54 - ${state.commercial.incendios.type}`, 20, y);
                    doc.text(`• Detectores Ópticos/Térmicos: ${state.commercial.incendios.detectors} uds.`, 20, y + 5);
                    doc.text(`• Pulsadores Manuales de Alarma: ${state.commercial.incendios.callpoints} uds.`, 20, y + 10);
                    y += 16;
                } else {
                    photos = state.commercial.generalPhotos[disp] || [];
                    if (state.commercial[disp]?.brand) {
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`Equipamiento Propuesto: ${state.commercial[disp].brand}`, 20, y);
                        doc.setFont('Helvetica', 'normal');
                        y += 6;
                    }
                    const textLines = doc.splitTextToSize(state.commercial[disp]?.notes || 'Sin especificaciones técnicas adicionales.', 170);
                    doc.text(textLines, 20, y);
                    y += (textLines.length * 5) + 3;
                }

                // Embed photos inside PDF
                if (photos.length > 0) {
                    y += 4;
                    if (y > 220) {
                        doc.addPage();
                        y = 20;
                    }
                    doc.setFont('Helvetica', 'bold');
                    doc.setFontSize(8.5);
                    doc.setTextColor(100, 116, 139);
                    doc.text('Imágenes Adjuntas:', 20, y);
                    y += 4;
                    
                    let imgX = 20;
                    let imgWidth = 40;
                    let imgHeight = 30;
                    
                    for (let photo of photos) {
                        if (imgX + imgWidth > 190) {
                            imgX = 20;
                            y += imgHeight + 4;
                        }
                        if (y + imgHeight > 270) {
                            doc.addPage();
                            y = 20;
                            imgX = 20;
                        }
                        doc.addImage(photo, 'JPEG', imgX, y, imgWidth, imgHeight);
                        imgX += imgWidth + 5;
                    }
                    y += imgHeight + 8;
                }
                y += 5;
            }
        } else if (state.commercial.mode === 'rondas') {
            const rounds = state.commercial.rounds || { travelTime: 0, travelKm: 0, points: [] };
            const points = rounds.points || [];
            const pointsTime = points.reduce((acc, p) => acc + p.time, 0);
            
            const kmCost = rounds.travelKm * 0.50;
            const travelCost = rounds.travelTime * 1.00;
            const pointsCost = pointsTime * 1.00;
            const totalCost = kmCost + travelCost + pointsCost;

            doc.setFillColor(241, 245, 249);
            doc.rect(15, y, 180, 7, 'F');
            doc.setTextColor(1, 30, 65); // Navy
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.text('DETALLES DEL SERVICIO DE RONDAS', 18, y + 5);
            y += 12;

            doc.setTextColor(30, 41, 59);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.text(`• Distancia de Desplazamiento Base: ${rounds.travelKm.toFixed(1)} km`, 20, y);
            doc.text(`• Tiempo de Desplazamiento Base: ${rounds.travelTime} minutos`, 20, y + 5);
            doc.text(`• Tiempo Total de Rondas en Cliente: ${pointsTime} minutos`, 20, y + 10);
            
            y += 20;

            if (y > 240) {
                doc.addPage();
                y = 20;
            }

            // Table of points
            doc.setFillColor(1, 30, 65);
            doc.rect(15, y, 180, 6, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text('Punto de Control / Ubicación', 18, y + 4.5);
            doc.text('Tiempo Estimado', 160, y + 4.5);
            
            y += 6;

            doc.setTextColor(51, 65, 85);
            doc.setFont('Helvetica', 'normal');
            
            if (points.length === 0) {
                doc.setTextColor(100, 116, 139);
                doc.setFont('Helvetica', 'italic');
                doc.text('No se han registrado puntos de control.', 20, y + 5);
                y += 10;
            } else {
                points.forEach(p => {
                    doc.text(p.name, 18, y + 5);
                    doc.text(`${p.time} minutos`, 160, y + 5);
                    
                    doc.setDrawColor(241, 245, 249);
                    doc.line(15, y + 7, 195, y + 7);
                    y += 7;

                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }
                });
                y += 5;
            }

            if (y > 200) {
                doc.addPage();
                y = 20;
            }

            // Cost Summary Block
            doc.setFillColor(241, 245, 249);
            doc.rect(15, y, 180, 7, 'F');
            doc.setTextColor(209, 10, 36); // Red section accent
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.text('DESGLOSE DE COSTES (Tarifa: 1€/min y 0.50€/km)', 18, y + 5);
            
            y += 12;

            doc.setTextColor(30, 41, 59);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9.5);

            doc.text(`• Coste de Kilometraje (${rounds.travelKm.toFixed(1)} km x 0.50 €/km):`, 20, y);
            doc.setFont('Helvetica', 'bold');
            doc.text(`${kmCost.toFixed(2)} €`, 160, y);
            doc.setFont('Helvetica', 'normal');

            doc.text(`• Coste de Tiempo Desplazamiento (${rounds.travelTime} min x 1.00 €/min):`, 20, y + 6);
            doc.setFont('Helvetica', 'bold');
            doc.text(`${travelCost.toFixed(2)} €`, 160, y + 6);
            doc.setFont('Helvetica', 'normal');

            doc.text(`• Coste de Tiempo Rondas (${pointsTime} min x 1.00 €/min):`, 20, y + 12);
            doc.setFont('Helvetica', 'bold');
            doc.text(`${pointsCost.toFixed(2)} €`, 160, y + 12);
            doc.setFont('Helvetica', 'normal');

            y += 20;
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(0.5);
            doc.line(15, y, 195, y);
            y += 6;

            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(16, 185, 129); // Green
            doc.text('COSTE TOTAL DEL SERVICIO:', 20, y);
            doc.text(`${totalCost.toFixed(2)} €`, 160, y);
            y += 10;
        } else {
            // Migration mode
            doc.setFillColor(241, 245, 249);
            doc.rect(15, y, 180, 7, 'F');
            doc.setTextColor(1, 30, 65); // Navy
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.text('AUDITORÍA TÉCNICA DE INFRAESTRUCTURA', 18, y + 5);
            y += 12;

            doc.setTextColor(30, 41, 59);
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.text(`• Modelo de Central Existente: ${state.commercial.migration.panelModel || 'No documentado'}`, 20, y);
            doc.text(`• Vías de Comunicación Instaladas: Canal ${state.commercial.migration.comms}`, 20, y + 5);
            doc.text(`• Estado del Equipamiento de CCTV (Cámaras/Grabación): ${state.commercial.migration.cctvStatus}`, 20, y + 10);

            y += 18;

            if (state.commercial.migration.notes) {
                doc.setFont('Helvetica', 'bold');
                doc.text('Notas de campo adicionales:', 20, y);
                doc.setFont('Helvetica', 'normal');
                y += 5;
                const noteLines = doc.splitTextToSize(state.commercial.migration.notes, 170);
                doc.text(noteLines, 20, y);
                y += (noteLines.length * 5) + 5;
            }

            // Add audit photos
            if (state.commercial.migration.photos.length > 0) {
                if (y > 220) {
                    doc.addPage();
                    y = 20;
                }
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(100, 116, 139);
                doc.text('Imágenes Adjuntas de la Auditoría:', 20, y);
                y += 4;
                
                let imgX = 20;
                let imgWidth = 40;
                let imgHeight = 30;

                for (let photo of state.commercial.migration.photos) {
                    if (imgX + imgWidth > 190) {
                        imgX = 20;
                        y += imgHeight + 4;
                    }
                    if (y + imgHeight > 270) {
                        doc.addPage();
                        y = 20;
                        imgX = 20;
                    }
                    doc.addImage(photo, 'JPEG', imgX, y, imgWidth, imgHeight);
                    imgX += imgWidth + 5;
                }
                y += imgHeight + 10;
            }

            // Check height for table
            if (y > 180) {
                doc.addPage();
                y = 20;
            }

            // Render Inventory Table inside PDF
            doc.setFillColor(241, 245, 249);
            doc.rect(15, y, 180, 7, 'F');
            doc.setTextColor(209, 10, 36);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.text('INVENTARIO AUDITADO (REUTILIZAR / SUSTITUIR)', 18, y + 5);
            
            y += 12;

            // Table Header
            doc.setFillColor(1, 30, 65);
            doc.rect(15, y, 180, 6, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text('Elemento de Seguridad', 18, y + 4.5);
            doc.text('Cant.', 140, y + 4.5);
            doc.text('Acción Sugerida', 165, y + 4.5);

            y += 6;

            const auditItems = state.commercial.inventory.filter(item => item.qty > 0);
            if (auditItems.length === 0) {
                doc.setTextColor(100, 116, 139);
                doc.setFont('Helvetica', 'italic');
                doc.text('No se han registrado elementos en el inventario.', 20, y + 5);
                y += 10;
            } else {
                doc.setTextColor(51, 65, 85);
                doc.setFont('Helvetica', 'normal');
                auditItems.forEach(item => {
                    doc.text(item.name, 18, y + 5);
                    doc.text(item.qty.toString(), 142, y + 5);
                    
                    if (item.status === 'Sustituir') {
                        doc.setTextColor(209, 10, 36); // Red
                    } else if (item.status === 'Reutilizar') {
                        doc.setTextColor(16, 185, 129); // Green
                    } else {
                        doc.setTextColor(100, 116, 139); // Gray
                    }
                    doc.text(item.status, 165, y + 5);
                    doc.setTextColor(51, 65, 85); // Restore black

                    // draw line
                    doc.setDrawColor(241, 245, 249);
                    doc.line(15, y + 7, 195, y + 7);
                    y += 7;

                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }
                });
            }
        }

        // Add Signature Block/Footer
        if (y > 240) {
            doc.addPage();
            y = 20;
        }
        y += 15;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, y, 90, y);
        doc.line(120, y, 195, y);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Firma Comercial / Técnico (JMSYSTEMS)', 15, y + 4);
        doc.text('Firma Conformidad Cliente', 120, y + 4);

        // Save/Share Process
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });

        // Check if navigator.share and file sharing are supported
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: emailSubject,
                text: `Informe Técnico Comercial generado para el cliente: ${state.commercial.client.name}.`
            });
            showToast('¡Informe compartido con éxito!');
        } else {
            // Fallback: download directly
            doc.save(filename);
            showToast('Web Share no soportado. Se ha descargado el PDF.', 'info');
            
            // Auto open email client with mailto link
            const mailtoUrl = `mailto:${encodeURIComponent(state.commercial.client.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent('Hola, adjunto el informe técnico comercial que se acaba de descargar en mi dispositivo.')}`;
            window.location.href = mailtoUrl;
        }

    } catch (error) {
        console.error('Error durante la generación/envío de PDF', error);
        showToast('Ocurrió un error al procesar el archivo.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// Helpers
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// COMMERCIAL HISTORICAL METHODS
// ==========================================

async function saveCommercialReportToHistory() {
    if (!state.commercial.client.name) {
        showToast("Error: El cliente debe tener un nombre");
        return;
    }
    
    if (!state.vault.commercial_reports) {
        state.vault.commercial_reports = [];
    }
    
    const isNew = !state.commercial.id;
    if (isNew) {
        state.commercial.id = "comm_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    }
    
    const reportData = {
        id: state.commercial.id,
        date: new Date().toISOString(),
        author: state.currentUser ? state.currentUser.username : "admin",
        mode: state.commercial.mode,
        client: { ...state.commercial.client },
        selectedDisciplines: [...state.commercial.selectedDisciplines],
        intrusion: { ...state.commercial.intrusion },
        cctv: { ...state.commercial.cctv },
        incendios: { ...state.commercial.incendios },
        generalPhotos: { ...state.commercial.generalPhotos },
        migration: { ...state.commercial.migration },
        inventory: JSON.parse(JSON.stringify(state.commercial.inventory || [])),
        rounds: state.commercial.rounds ? JSON.parse(JSON.stringify(state.commercial.rounds)) : { travelTime: 0, travelKm: 0, points: [] }
    };
    
    if (isNew) {
        state.vault.commercial_reports.push(reportData);
    } else {
        const idx = state.vault.commercial_reports.findIndex(r => r.id === state.commercial.id);
        if (idx !== -1) {
            state.vault.commercial_reports[idx] = reportData;
        } else {
            state.vault.commercial_reports.push(reportData);
        }
    }
    
    try {
        showToast("Guardando preventa...");
        await syncWithCloud();
        showToast("Preventa guardada en el histórico");
        switchScreen("commercial-history");
    } catch (err) {
        console.error("Error saving to history:", err);
        showToast("Error al sincronizar cambios");
    }
}

function renderCommercialHistory() {
    const container = document.getElementById("list-commercial-history");
    if (!container) return;
    
    container.innerHTML = "";
    const searchEl = document.getElementById("search-commercial-history");
    const query = (searchEl ? searchEl.value : "").toLowerCase().trim();
    
    const reports = state.vault.commercial_reports || [];
    let filtered = reports;
    
    if (query) {
        filtered = reports.filter(r => {
            const clientName = (r.client?.name || "").toLowerCase();
            const delegacion = (r.client?.address || "").toLowerCase();
            const author = (r.author || "").toLowerCase();
            return clientName.includes(query) || delegacion.includes(query) || author.includes(query);
        });
    }
    
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-list" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No hay preventas guardadas${query ? ' que coincidan con la búsqueda' : ''}.</div>`;
        return;
    }
    
    filtered.forEach(r => {
        const clientName = r.client?.name || "Sin nombre";
        const dateStr = new Date(r.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const typeStr = r.mode === 'nueva' ? 'Nueva Instalación' : 
                        r.mode === 'rondas' ? 'Rondas de Vigilantes' : 'Migración / Auditoría';
        const typeClass = r.mode === 'nueva' ? 'badge-new' : 
                          r.mode === 'rondas' ? 'badge-rounds' : 'badge-migrate';
        const badgeBg = r.mode === 'nueva' ? 'var(--accent)' : 
                        r.mode === 'rondas' ? 'var(--success)' : '#e0a800';
        const authorStr = r.author || 'técnico';
        
        const card = document.createElement("div");
        card.className = "list-card anim-fade";
        card.style.background = "var(--bg-glass)";
        card.style.border = "1px solid var(--border-glass)";
        card.style.borderRadius = "var(--radius-md)";
        card.style.padding = "16px";
        card.style.marginBottom = "12px";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.gap = "10px";
        
        card.innerHTML = `
            <div class="card-main" style="display: flex; flex-direction: column; gap: 4px;">
                <div class="card-title-row" style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <span class="card-title" style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${escapeHtml(clientName)}</span>
                    <span class="badge ${typeClass}" style="padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; color: #fff; background: ${badgeBg};">${typeStr}</span>
                </div>
                <div class="card-detail-row" style="margin-top: 6px; font-size: 0.8rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                    <div>📅 ${dateStr}</div>
                    <div>👤 Creado por: <b>${escapeHtml(authorStr.toUpperCase())}</b></div>
                </div>
            </div>
            <div class="card-actions" style="display: flex; gap: 8px; margin-top: 5px; border-top: 1px solid var(--border-glass); padding-top: 10px; justify-content: flex-end;">
                <button class="btn-edit" title="Cargar y Editar" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; border: none; padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600;"><i class="bx bx-edit" style="font-size: 1rem;"></i> Editar</button>
                <button class="btn-delete" title="Eliminar" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: none; padding: 6px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600;"><i class="bx bx-trash" style="font-size: 1rem;"></i> Borrar</button>
            </div>
        `;
        
        card.querySelector(".btn-edit").addEventListener("click", () => {
            loadCommercialReportForEdit(r.id);
        });
        
        card.querySelector(".btn-delete").addEventListener("click", () => {
            deleteCommercialReport(r.id);
        });
        
        container.appendChild(card);
    });
}

function loadCommercialReportForEdit(id) {
    const report = (state.vault.commercial_reports || []).find(r => r.id === id);
    if (!report) {
        showToast("Error: No se encontró la preventa");
        return;
    }
    
    // Load data back into state
    state.commercial.id = report.id;
    state.commercial.mode = report.mode;
    state.commercial.client = { ...report.client };
    state.commercial.selectedDisciplines = [...(report.selectedDisciplines || [])];
    state.commercial.intrusion = { ...report.intrusion };
    state.commercial.cctv = { ...report.cctv };
    state.commercial.incendios = { ...report.incendios };
    state.commercial.generalPhotos = { ...report.generalPhotos };
    state.commercial.migration = { ...report.migration };
    state.commercial.inventory = JSON.parse(JSON.stringify(report.inventory || []));
    state.commercial.rounds = report.rounds ? JSON.parse(JSON.stringify(report.rounds)) : { travelTime: 0, travelKm: 0, points: [] };
    
    // Set UI client form values
    document.getElementById('input-client-name').value = state.commercial.client.name || '';
    document.getElementById('input-client-phone').value = state.commercial.client.phone || '';
    document.getElementById('input-client-email').value = state.commercial.client.email || '';
    document.getElementById('input-client-address').value = state.commercial.client.address || '';
    
    if (state.commercial.mode === 'nueva') {
        document.getElementById('client-title').innerText = 'Datos de Nueva Instalación';
    } else if (state.commercial.mode === 'rondas') {
        document.getElementById('client-title').innerText = 'Datos de Rondas de Vigilantes';
        document.getElementById('input-rounds-km').value = state.commercial.rounds.travelKm || 0;
        document.getElementById('input-rounds-travel-time').value = state.commercial.rounds.travelTime || 0;
    } else {
        document.getElementById('client-title').innerText = 'Datos de Auditoría / Migración';
        // Set migration values
        document.getElementById('input-mig-panel').value = state.commercial.migration.panelModel || '';
        document.getElementById('select-mig-comms').value = state.commercial.migration.comms || 'IP';
        document.getElementById('select-mig-cctv').value = state.commercial.migration.cctvStatus || 'Buen estado';
        document.getElementById('textarea-mig-notes').value = state.commercial.migration.notes || '';
    }
    
    // Generate summary and redirect to summary screen
    generateSummary();
    switchScreen("commercial-summary");
    showToast("Preventa cargada para editar");
}

async function deleteCommercialReport(id) {
    const report = (state.vault.commercial_reports || []).find(r => r.id === id);
    if (!report) return;
    
    const clientName = report.client ? report.client.name : "Sin nombre";
    if (!confirm(`¿Estás seguro de que deseas eliminar la preventa de "${clientName}"?`)) {
        return;
    }
    
    state.vault.commercial_reports = state.vault.commercial_reports.filter(r => r.id !== id);
    
    try {
        showToast("Eliminando preventa...");
        await syncWithCloud();
        showToast("Preventa eliminada correctamente");
        renderCommercialHistory();
    } catch (err) {
        console.error("Error deleting report:", err);
        showToast("Error al sincronizar cambios");
    }
}

// ==========================================
// VACATION MODULE METHODS v1.14.00
// ==========================================

function initVacationsScreen() {
    state.vacation.currentDate = new Date();
    // Default request date inputs to current date
    const todayStr = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById("vac-start-date");
    const endInput = document.getElementById("vac-end-date");
    if (startInput) startInput.value = todayStr;
    if (endInput) endInput.value = todayStr;
    
    // Hide request form card initially
    const reqCard = document.getElementById("vacations-request-card");
    if (reqCard) reqCard.style.display = "none";
    
    renderVacationCalendar();
    renderVacationsSummary();
    renderAdminVacationsPending();
    updateVacationBadge();
    updateVacationCounter();
    renderAdminVacationsSummary();
}

function renderVacationCalendar() {
    const grid = document.getElementById("vac-calendar-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    const d = state.vacation.currentDate;
    const year = d.getFullYear();
    const activeView = state.vacation.activeView || "monthly";
    const titleEl = document.getElementById("vac-calendar-title");
    const weekdaysHeader = document.getElementById("vac-calendar-weekdays-header");
    
    if (activeView === "yearly") {
        if (titleEl) titleEl.textContent = `Año ${year}`;
        if (weekdaysHeader) weekdaysHeader.style.display = "none";
        
        // Change grid styling to show months
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(180px, 1fr))";
        grid.style.gap = "15px";
        
        const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const today = new Date();
        const vacations = state.vault.vacations || [];
        
        for (let m = 0; m < 12; m++) {
            const monthCard = document.createElement("div");
            monthCard.className = "glass-card";
            monthCard.style.padding = "10px";
            monthCard.style.display = "flex";
            monthCard.style.flexDirection = "column";
            monthCard.style.gap = "8px";
            monthCard.style.border = "1px solid var(--border-glass)";
            
            const monthTitle = document.createElement("div");
            monthTitle.style.fontSize = "0.85rem";
            monthTitle.style.fontWeight = "bold";
            monthTitle.style.color = "var(--accent)";
            monthTitle.style.textAlign = "center";
            monthTitle.style.borderBottom = "1px solid var(--border-glass)";
            monthTitle.style.paddingBottom = "4px";
            monthTitle.textContent = months[m];
            monthCard.appendChild(monthTitle);
            
            // Mini calendar grid weekdays: L M X J V S D
            const miniWeekdays = document.createElement("div");
            miniWeekdays.style.display = "grid";
            miniWeekdays.style.gridTemplateColumns = "repeat(7, 1fr)";
            miniWeekdays.style.textAlign = "center";
            miniWeekdays.style.fontSize = "0.6rem";
            miniWeekdays.style.color = "var(--text-secondary)";
            miniWeekdays.style.fontWeight = "600";
            miniWeekdays.innerHTML = "<div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div><div>D</div>";
            monthCard.appendChild(miniWeekdays);
            
            const miniGrid = document.createElement("div");
            miniGrid.style.display = "grid";
            miniGrid.style.gridTemplateColumns = "repeat(7, 1fr)";
            miniGrid.style.gap = "2px";
            miniGrid.style.textAlign = "center";
            
            const firstDayOfMonth = new Date(year, m, 1);
            let startDayOfWeek = firstDayOfMonth.getDay() - 1;
            if (startDayOfWeek < 0) startDayOfWeek = 6;
            
            const daysInMonth = new Date(year, m + 1, 0).getDate();
            
            // Empty cells
            for (let i = 0; i < startDayOfWeek; i++) {
                const empty = document.createElement("div");
                empty.style.aspectRatio = "1";
                miniGrid.appendChild(empty);
            }
            
            // Day cells
            for (let day = 1; day <= daysInMonth; day++) {
                const dayCell = document.createElement("div");
                dayCell.style.aspectRatio = "1";
                dayCell.style.display = "flex";
                dayCell.style.alignItems = "center";
                dayCell.style.justifyContent = "center";
                dayCell.style.fontSize = "0.7rem";
                dayCell.style.borderRadius = "4px";
                dayCell.style.cursor = "pointer";
                dayCell.style.userSelect = "none";
                dayCell.textContent = day;
                
                const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                if (day === today.getDate() && m === today.getMonth() && year === today.getFullYear()) {
                    dayCell.style.border = "1px solid var(--accent)";
                    dayCell.style.color = "var(--accent)";
                    dayCell.style.fontWeight = "bold";
                }
                
                const matchingRequests = vacations.filter(v => {
                    return v.dates && v.dates.includes(dateStr) && v.status !== "rejected";
                });
                
                if (matchingRequests.length > 0) {
                    const hasPending = matchingRequests.some(r => r.status === "pending");
                    const colors = matchingRequests.map(r => getTechColor(r.username));
                    const uniqueColors = [...new Set(colors)];
                    
                    if (uniqueColors.length === 1) {
                        dayCell.style.background = uniqueColors[0];
                    } else {
                        const percent = 100 / uniqueColors.length;
                        let gradParts = [];
                        uniqueColors.forEach((color, idx) => {
                            gradParts.push(`${color} ${idx * percent}%`);
                            gradParts.push(`${color} ${(idx + 1) * percent}%`);
                        });
                        dayCell.style.background = `linear-gradient(135deg, ${gradParts.join(', ')})`;
                    }
                    dayCell.style.color = "#ffffff";
                    dayCell.style.fontWeight = "bold";
                    
                    if (hasPending) {
                        dayCell.style.border = "1px solid var(--warning)";
                    } else {
                        dayCell.style.border = "1px solid var(--success)";
                    }
                } else {
                    dayCell.style.background = "rgba(255,255,255,0.02)";
                    dayCell.style.color = "var(--text-primary)";
                }
                
                // Clicking a day in yearly view changes to monthly view of that month!
                dayCell.addEventListener("click", () => {
                    state.vacation.currentDate = new Date(year, m, day);
                    state.vacation.activeView = "monthly";
                    
                    const btnMonthly = document.getElementById("btn-vac-view-monthly");
                    const btnYearly = document.getElementById("btn-vac-view-yearly");
                    if (btnMonthly && btnYearly) {
                        btnMonthly.classList.remove("btn-secondary");
                        btnYearly.classList.add("btn-secondary");
                    }
                    
                    renderVacationCalendar();
                });
                
                miniGrid.appendChild(dayCell);
            }
            
            monthCard.appendChild(miniGrid);
            grid.appendChild(monthCard);
        }
        return;
    }
    
    // Vista Mensual
    if (weekdaysHeader) weekdaysHeader.style.display = "grid";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(7, 1fr)";
    grid.style.gap = "4px";
    
    const month = d.getMonth(); // 0-indexed
    
    // Set title
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    document.getElementById("vac-calendar-title").textContent = `${months[month]} ${year}`;
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Day of week of first day (0=Sunday, 1=Monday, ..., 6=Saturday)
    // Convert to European standard (0=Monday, ..., 6=Sunday)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;
    
    // Number of days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Empty cells before start day
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day empty";
        grid.appendChild(emptyCell);
    }
    
    const today = new Date();
    const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    
    // Get all vacations from vault
    const vacations = state.vault.vacations || [];
    
    // Generate day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day";
        dayCell.textContent = day;
        
        // Build YYYY-MM-DD string for this day
        const currentMonthStr = String(month + 1).padStart(2, '0');
        const currentDayStr = String(day).padStart(2, '0');
        const dateStr = `${year}-${currentMonthStr}-${currentDayStr}`;
        
        // Check if this date is today
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayCell.classList.add("today");
        }
        
        // Find matching vacation requests that overlap with this date
        const matchingRequests = vacations.filter(v => {
            return v.dates && v.dates.includes(dateStr) && v.status !== "rejected";
        });
        
        if (matchingRequests.length > 0) {
            const hasPending = matchingRequests.some(r => r.status === "pending");
            const colors = matchingRequests.map(r => getTechColor(r.username));
            const uniqueColors = [...new Set(colors)];
            
            if (uniqueColors.length === 1) {
                dayCell.style.background = uniqueColors[0];
            } else {
                const percent = 100 / uniqueColors.length;
                let gradParts = [];
                uniqueColors.forEach((color, idx) => {
                    gradParts.push(`${color} ${idx * percent}%`);
                    gradParts.push(`${color} ${(idx + 1) * percent}%`);
                });
                dayCell.style.background = `linear-gradient(135deg, ${gradParts.join(', ')})`;
            }
            dayCell.style.color = "#ffffff";
            dayCell.style.textShadow = "0 1px 2px rgba(0,0,0,0.6)";
            dayCell.style.fontWeight = "bold";
            
            if (hasPending) {
                dayCell.style.border = "1.5px solid var(--warning)";
                dayCell.style.boxShadow = "inset 0 0 5px rgba(245, 158, 11, 0.6)";
            } else {
                dayCell.style.border = "1.5px solid var(--success)";
            }
            
            // Build tooltip text listing requesters
            let tooltip = "";
            if (isAdmin) {
                const names = matchingRequests.map(r => `${r.fullName || r.username.toUpperCase()} (${r.status === 'pending' ? 'Pendiente' : 'Aceptado'})`);
                tooltip = names.join(", ");
            } else {
                // If technician, just show own status or "Ocupado"
                const myMatch = matchingRequests.some(r => {
                    const rUser = (r.username || "").toLowerCase();
                    const currUser = (state.currentUser?.username || "").toLowerCase();
                    return rUser === currUser;
                });
                if (myMatch) {
                    tooltip = "Tus vacaciones (" + (hasPending ? "Pendiente" : "Aceptado") + ")";
                } else {
                    tooltip = "Reservado por otro técnico";
                }
            }
            dayCell.setAttribute("title", tooltip);
            
            // Add tiny indicators for multiple requests
            if (matchingRequests.length > 1) {
                const dotsContainer = document.createElement("div");
                dotsContainer.className = "calendar-day-dots";
                matchingRequests.forEach(r => {
                    const dot = document.createElement("span");
                    dot.className = "cal-dot " + (r.status === "pending" ? "pending" : "approved");
                    dotsContainer.appendChild(dot);
                });
                dayCell.appendChild(dotsContainer);
            }
        }
        
        // Click to view/toggle day detail
        dayCell.addEventListener("click", () => {
            handleCalendarDayClick(dateStr, matchingRequests);
        });
        
        grid.appendChild(dayCell);
    }
}

function navigateVacMonth(dir) {
    const d = state.vacation.currentDate;
    if (state.vacation.activeView === "yearly") {
        d.setFullYear(d.getFullYear() + dir);
    } else {
        d.setMonth(d.getMonth() + dir);
    }
    state.vacation.currentDate = d;
    renderVacationCalendar();
}

function toggleVacationRequestForm() {
    const reqCard = document.getElementById("vacations-request-card");
    if (!reqCard) return;
    if (reqCard.style.display === "none") {
        reqCard.style.display = "block";
        reqCard.scrollIntoView({ behavior: 'smooth' });
        
        // Admin tech selection populate
        const selectContainer = document.getElementById("vac-tech-select-container");
        const select = document.getElementById("vac-tech-select");
        const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
        
        if (isAdmin && selectContainer && select) {
            selectContainer.style.display = "block";
            select.innerHTML = "";
            
            // Add self first
            const myOpt = document.createElement("option");
            myOpt.value = state.currentUser.username;
            myOpt.textContent = `A mi nombre (${state.currentUser.fullName || state.currentUser.username.toUpperCase()})`;
            select.appendChild(myOpt);
            
            // Add other users
            const users = state.vault.users || [];
            users.forEach(u => {
                if (u.username.toLowerCase() !== state.currentUser.username.toLowerCase()) {
                    const opt = document.createElement("option");
                    opt.value = u.username;
                    opt.textContent = u.fullName || u.username.toUpperCase();
                    select.appendChild(opt);
                }
            });
        } else if (selectContainer) {
            selectContainer.style.display = "none";
        }
    } else {
        reqCard.style.display = "none";
    }
}

async function submitVacationRequest(evt) {
    evt.preventDefault();
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    
    const startVal = document.getElementById("vac-start-date").value;
    const endVal = document.getElementById("vac-end-date").value;
    const comment = document.getElementById("vac-comment").value.trim();
    
    if (!startVal || !endVal) {
        showToast("Por favor selecciona ambas fechas");
        return;
    }
    
    const start = new Date(startVal);
    const end = new Date(endVal);
    
    if (end < start) {
        showToast("La fecha de fin no puede ser anterior a la de inicio");
        return;
    }
    
    // Generate dates array
    const dates = [];
    let current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    
    const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    let targetUsername = state.currentUser ? state.currentUser.username : "admin";
    let targetFullName = state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "TÉCNICO";
    let requestStatus = "pending";
    
    if (isAdmin) {
        const select = document.getElementById("vac-tech-select");
        if (select && select.value) {
            targetUsername = select.value.toLowerCase();
            const foundUser = (state.vault.users || []).find(u => u.username.toLowerCase() === targetUsername);
            targetFullName = foundUser ? (foundUser.fullName || targetUsername.toUpperCase()) : targetUsername.toUpperCase();
        }
        
        // Auto-approve ONLY if the logged-in user has the 'admin' role
        if (state.currentUser && state.currentUser.role === "admin") {
            requestStatus = "approved";
        } else {
            requestStatus = "pending";
        }
    }
    
    const editingId = state.vacation.editingId;
    let requestData;
    
    if (editingId) {
        if (!state.vault.vacations) state.vault.vacations = [];
        const existing = state.vault.vacations.find(v => v.id == editingId);
        if (existing) {
            existing.dates = dates;
            existing.comments = comment;
            if (isAdmin) {
                const select = document.getElementById("vac-tech-select");
                if (select && select.value) {
                    existing.username = select.value.toLowerCase();
                    const foundUser = (state.vault.users || []).find(u => u.username.toLowerCase() === existing.username);
                    existing.fullName = foundUser ? (foundUser.fullName || existing.username.toUpperCase()) : existing.username.toUpperCase();
                }
                
                // Force approve only if edited by 'admin'
                if (state.currentUser && state.currentUser.role === "admin") {
                    existing.status = "approved";
                } else {
                    existing.status = "pending";
                }
            } else {
                existing.status = "pending"; // Reset to pending for technician edits
            }
            requestData = existing;
        } else {
            // Fallback if not found
            requestData = {
                id: editingId,
                username: targetUsername,
                fullName: targetFullName,
                dates: dates,
                status: requestStatus,
                comments: comment,
                requestDate: new Date().toISOString().split('T')[0]
            };
            state.vault.vacations.unshift(requestData);
        }
    } else {
        requestData = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            username: targetUsername,
            fullName: targetFullName,
            dates: dates,
            status: requestStatus,
            comments: comment,
            requestDate: new Date().toISOString().split('T')[0]
        };
        
        if (!state.vault.vacations) state.vault.vacations = [];
        state.vault.vacations.unshift(requestData);
    }
    
    setSyncStatus(false);
    showToast(isAdmin ? "Vacaciones registradas" : "Solicitud registrada localmente");
    
    // Hide form
    document.getElementById("vacations-request-card").style.display = "none";
    document.getElementById("vac-comment").value = "";
    state.vacation.editingId = null;
    
    // Refresh lists & calendar
    renderVacationCalendar();
    renderVacationsSummary();
    renderAdminVacationsPending();
    updateVacationBadge();
    updateVacationCounter();
    renderAdminVacationsSummary();
    
    // Sync to cloud
    await syncWithCloud();
    
    // Send Telegram alert
    const rangeText = dates.length === 1 ? `${startVal}` : `${startVal} al ${endVal} (${dates.length} días)`;
    const subtipoText = isAdmin ? "Registro" : "Solicitud";
    const estadoText = isAdmin ? "APROBADO" : "PENDIENTE DE VALIDAR";
    
    enviarAlertaTelegram("Vacaciones", {
        subtipo: subtipoText,
        tecnico: requestData.fullName,
        detalle: `${isAdmin ? "Administrador registra" : "Solicita"} vacaciones para el rango: ${rangeText}. Comentario: ${comment || "Ninguno"}`,
        estado: estadoText
    });
}

function renderVacationsSummary() {
    const list = document.getElementById("vacations-summary-list");
    if (!list) return;
    list.innerHTML = "";
    
    const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    let requests = state.vault.vacations || [];
    
    // If not admin, technician only sees their own requests
    if (!isAdmin) {
        requests = requests.filter(r => {
            const rUser = (r.username || "").toLowerCase();
            const currUser = (state.currentUser?.username || "").toLowerCase();
            return rUser === currUser;
        });
        document.getElementById("vac-summary-title").textContent = "Resumen de mis Solicitudes";
    } else {
        document.getElementById("vac-summary-title").textContent = "Todas las Solicitudes (General)";
    }
    
    if (requests.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:0.85rem;">No hay solicitudes registradas</div>`;
        return;
    }
    
    requests.forEach(r => {
        const card = document.createElement("div");
        card.className = "vacation-item-card anim-fade";
        card.style.background = "rgba(255, 255, 255, 0.02)";
        
        const dateRangeText = r.dates.length === 1 ? 
            formatSpanishDate(r.dates[0]) : 
            `${formatSpanishDate(r.dates[0])} al ${formatSpanishDate(r.dates[r.dates.length - 1])} (${r.dates.length} días)`;
            
        const commentText = r.comments ? `<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic; margin-top:2px;">💬 ${escapeHtml(r.comments)}</div>` : "";
        const ownerName = isAdmin ? `<span style="font-weight:600; color:var(--accent);">${escapeHtml(r.fullName)}</span> • ` : "";
        
        const todayStr = new Date().toISOString().split('T')[0];
        const isFuture = r.dates && r.dates.some(d => d >= todayStr);
        const rUser = (r.username || "").toLowerCase();
        const currUser = (state.currentUser?.username || "").toLowerCase();
        
        const canModify = isAdmin || (rUser === currUser && (r.status === "pending" || (r.status === "approved" && isFuture)));
        
        let actionBtns = "";
        if (canModify) {
            actionBtns = `
                <button class="btn-icon btn-edit-vac" data-id="${r.id}" style="color:var(--accent); border:none; background:transparent; cursor:pointer; padding:0 4px;" title="Editar Solicitud"><i class="bx bx-edit-alt" style="font-size:1.1rem;"></i></button>
                <button class="btn-icon btn-delete-vac" data-id="${r.id}" style="color:var(--danger); border:none; background:transparent; cursor:pointer; padding:0 4px;" title="Eliminar Solicitud"><i class="bx bx-trash" style="font-size:1.1rem;"></i></button>
            `;
        }
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <div style="font-size:0.9rem; font-weight:500;">${ownerName}${dateRangeText}</div>
                    ${commentText}
                    <div style="margin-top:5px; display:flex; gap:10px; font-size:0.75rem; color:var(--text-secondary);">
                        <span>Solicitado: ${formatSpanishDate(r.requestDate || r.dates[0])}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="vacation-status-badge ${r.status}">${r.status === 'pending' ? 'Pendiente' : r.status === 'approved' ? 'Validado' : 'Denegado'}</span>
                    ${actionBtns}
                </div>
            </div>
        `;
        
        if (canModify) {
            card.querySelector(".btn-delete-vac").addEventListener("click", (evt) => {
                evt.stopPropagation();
                deleteVacationRequest(r.id);
            });
            card.querySelector(".btn-edit-vac").addEventListener("click", (evt) => {
                evt.stopPropagation();
                editVacationRequest(r);
            });
        }
        
        list.appendChild(card);
    });
}

function editVacationRequest(r) {
    const reqCard = document.getElementById("vacations-request-card");
    if (!reqCard) return;
    
    // Set editing ID in state first
    state.vacation.editingId = r.id;
    
    // Open the form card
    reqCard.style.display = "block";
    reqCard.scrollIntoView({ behavior: "smooth" });
    
    // Set form fields
    document.getElementById("vac-start-date").value = r.dates[0];
    document.getElementById("vac-end-date").value = r.dates[r.dates.length - 1];
    document.getElementById("vac-comment").value = r.comments || "";
    
    // Handle admin tech selector if user has rights
    const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    const selectContainer = document.getElementById("vac-tech-select-container");
    const select = document.getElementById("vac-tech-select");
    
    if (isAdmin && selectContainer && select) {
        selectContainer.style.display = "block";
        select.innerHTML = "";
        
        // Add self first
        const myOpt = document.createElement("option");
        myOpt.value = state.currentUser.username;
        myOpt.textContent = `A mi nombre (${state.currentUser.fullName || state.currentUser.username.toUpperCase()})`;
        select.appendChild(myOpt);
        
        // Add other users
        const users = state.vault.users || [];
        users.forEach(u => {
            if (u.username.toLowerCase() !== state.currentUser.username.toLowerCase()) {
                const opt = document.createElement("option");
                opt.value = u.username;
                opt.textContent = u.fullName || u.username.toUpperCase();
                select.appendChild(opt);
            }
        });
        
        select.value = r.username.toLowerCase();
    } else if (selectContainer) {
        selectContainer.style.display = "none";
    }
    
    updateVacationCounter(r.username);
}

async function deleteVacationRequest(id) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    
    if (confirm("¿Estás seguro de que deseas eliminar esta solicitud de vacaciones?")) {
        state.vault.vacations = state.vault.vacations.filter(v => v.id !== id);
        setSyncStatus(false);
        renderVacationCalendar();
        renderVacationsSummary();
        renderAdminVacationsPending();
        updateVacationBadge();
        updateVacationCounter();
        renderAdminVacationsSummary();
        
        await syncWithCloud();
        showToast("Solicitud eliminada");
    }
}

function renderAdminVacationsPending() {
    const panel = document.getElementById("vacations-admin-panel");
    const list = document.getElementById("vacations-pending-list");
    if (!panel || !list) return;
    
    const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    if (!isAdmin) {
        panel.style.display = "none";
        return;
    }
    
    const pending = (state.vault.vacations || []).filter(v => v.status === "pending");
    if (pending.length === 0) {
        panel.style.display = "none";
        return;
    }
    
    panel.style.display = "block";
    list.innerHTML = "";
    
    pending.forEach(r => {
        const item = document.createElement("div");
        item.style.background = "rgba(255, 255, 255, 0.03)";
        item.style.border = "1px solid var(--border-glass)";
        item.style.borderRadius = "var(--radius-sm)";
        item.style.padding = "10px 14px";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        
        const dateRangeText = r.dates.length === 1 ? 
            formatSpanishDate(r.dates[0]) : 
            `${formatSpanishDate(r.dates[0])} al ${formatSpanishDate(r.dates[r.dates.length - 1])} (${r.dates.length} días)`;
            
        const commentHtml = r.comments ? `<div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">💬 ${escapeHtml(r.comments)}</div>` : "";
        
        item.innerHTML = `
            <div>
                <div style="font-weight:600; font-size:0.9rem; color:var(--accent);">${escapeHtml(r.fullName)}</div>
                <div style="font-size:0.85rem; color:var(--text-primary); margin-top:2px;">${dateRangeText}</div>
                ${commentHtml}
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-approve btn-premium" style="background:var(--success); border:none; padding:4px 8px; font-size:0.75rem; height:28px;" type="button">Validar</button>
                <button class="btn-reject btn-premium" style="background:var(--danger); border:none; padding:4px 8px; font-size:0.75rem; height:28px;" type="button">Denegar</button>
            </div>
        `;
        
        item.querySelector(".btn-approve").addEventListener("click", () => resolveVacationRequest(r.id, "approved"));
        item.querySelector(".btn-reject").addEventListener("click", () => resolveVacationRequest(r.id, "rejected"));
        
        list.appendChild(item);
    });
}

async function resolveVacationRequest(id, status) {
    if (state.currentUser && state.currentUser.role === "viewer") {
        showToast("Error: Acceso de sólo lectura");
        return;
    }
    
    const request = (state.vault.vacations || []).find(v => v.id === id);
    if (!request) return;
    
    request.status = status;
    setSyncStatus(false);
    
    renderVacationCalendar();
    renderVacationsSummary();
    renderAdminVacationsPending();
    updateVacationBadge();
    updateVacationCounter();
    renderAdminVacationsSummary();
    
    await syncWithCloud();
    showToast(status === "approved" ? "Vacaciones validadas" : "Vacaciones denegadas");
    
    // Telegram notification
    const rangeText = request.dates.length === 1 ? `${request.dates[0]}` : `${request.dates[0]} al ${request.dates[request.dates.length - 1]} (${request.dates.length} días)`;
    const adminUser = state.currentUser ? (state.currentUser.fullName || state.currentUser.username.toUpperCase()) : "ADMIN";
    enviarAlertaTelegram("Vacaciones", {
        subtipo: "Resolución",
        tecnico: request.fullName,
        detalle: `Resolución para el rango: ${rangeText}`,
        estado: status === "approved" ? `APROBADO por ${adminUser}` : `DENEGADO por ${adminUser}`
    });
}

function updateVacationBadge() {
    const badge = document.getElementById("vacation-badge");
    if (!badge) return;
    
    const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    if (!isAdmin) {
        badge.style.display = "none";
        return;
    }
    
    const pendingCount = (state.vault.vacations || []).filter(v => v.status === "pending").length;
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

function handleCalendarDayClick(dateStr, matchingRequests) {
    // Set Date input fields in request form to clicked day for convenience
    document.getElementById("vac-start-date").value = dateStr;
    document.getElementById("vac-end-date").value = dateStr;
    
    if (matchingRequests.length === 0) {
        showToast(`Día libre: ${formatSpanishDate(dateStr)}`);
        return;
    }
    
    const details = matchingRequests.map(r => {
        const statusText = r.status === 'pending' ? 'Pendiente' : 'Aceptado';
        return `${r.fullName || r.username.toUpperCase()} (${statusText})`;
    }).join(", ");
    
    showToast(`${formatSpanishDate(dateStr)}: ${details}`);
}

function formatSpanishDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// v1.14.02 Vacation Business Days count helper
function getBusinessDaysCount(datesArray) {
    if (!datesArray || !Array.isArray(datesArray)) return 0;
    let count = 0;
    datesArray.forEach(dStr => {
        // Safe YYYY-MM-DD split constructor (avoiding browser compatibility issues with ISO-like strings)
        const parts = dStr.split("-");
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed month
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
            if (!isNaN(dayOfWeek) && dayOfWeek !== 0 && dayOfWeek !== 6) {
                count++;
            }
        }
    });
    return count;
}

// v1.14.06 Calculate vacation allowance proportionally based on company entry date
function getUserVacationAllowance(user, year) {
    if (!user) return 23;
    const hireDateStr = user.hireDate;
    if (!hireDateStr) return 23;
    
    // Parse entry date safely (YYYY-MM-DD)
    const parts = hireDateStr.split('-');
    if (parts.length !== 3) return 23;
    const entryDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(entryDate.getTime())) return 23;
    
    const entryYear = entryDate.getFullYear();
    
    if (entryYear < year) {
        return 23; // Entered before this year, full 23 days
    } else if (entryYear > year) {
        return 0; // Has not entered company yet in this year
    } else {
        // Entered during this year. Calculate proportional days.
        const endOfYear = new Date(year, 11, 31);
        const diffTime = Math.abs(endOfYear - entryDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        
        // Total days in this year
        const startOfYear = new Date(year, 0, 1);
        const totalYearTime = Math.abs(endOfYear - startOfYear);
        const totalYearDays = Math.ceil(totalYearTime / (1000 * 60 * 60 * 24)) + 1;
        
        const proportion = diffDays / totalYearDays;
        return Math.round(proportion * 23);
    }
}

// v1.14.02 Update vacation counter panel
function updateVacationCounter(username = null) {
    const approvedEl = document.getElementById("vac-counter-approved");
    const pendingEl = document.getElementById("vac-counter-pending");
    const remainingEl = document.getElementById("vac-counter-remaining");
    const nameEl = document.getElementById("vac-counter-tech-name");
    
    if (!approvedEl || !pendingEl || !remainingEl) return;
    
    const targetUser = username || (state.currentUser ? state.currentUser.username : "admin");
    const foundUser = state.vault.users.find(u => u.username.toLowerCase() === targetUser.toLowerCase());
    const fullName = foundUser ? (foundUser.fullName || targetUser.toUpperCase()) : targetUser.toUpperCase();
    
    if (nameEl) {
        nameEl.textContent = fullName;
    }
    
    let approvedDays = 0;
    let pendingDays = 0;
    
    const vacations = state.vault.vacations || [];
    vacations.forEach(v => {
        if ((v.username || "").toLowerCase() === targetUser.toLowerCase()) {
            const bizDays = getBusinessDaysCount(v.dates);
            if (v.status === "approved") {
                approvedDays += bizDays;
            } else if (v.status === "pending") {
                pendingDays += bizDays;
            }
        }
    });
    
    const year = state.vacation.currentDate.getFullYear();
    const totalAllowance = foundUser ? getUserVacationAllowance(foundUser, year) : 23;
    
    const labelEl = remainingEl.nextElementSibling;
    if (labelEl) {
        labelEl.textContent = `Restantes (de ${totalAllowance})`;
    }
    
    approvedEl.textContent = approvedDays;
    pendingEl.textContent = pendingDays;
    remainingEl.textContent = totalAllowance - approvedDays - pendingDays;
}

// v1.14.03 Distinct vibrant colors for technicians
const TECH_COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald Green
    "#8b5cf6", // Purple
    "#f59e0b", // Amber
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f43f5e", // Rose
    "#14b8a6", // Teal
    "#a855f7", // Purple-magenta
    "#eab308"  // Yellow
];

function getTechColor(username) {
    if (!username) return "#94a3b8"; // Default slate gray
    const name = username.toLowerCase().trim();
    if (name === "admin") return "#ef4444"; // Red for admin
    
    // Deterministic hash to map username to one of the colors
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % TECH_COLORS.length;
    return TECH_COLORS[idx];
}

// v1.14.03 Render Admin Vacation Summary widget
function renderAdminVacationsSummary() {
    const panel = document.getElementById("vacations-admin-summary-panel");
    const list = document.getElementById("vacations-admin-summary-list");
    if (!panel || !list) return;
    
    const isAdmin = state.currentUser && (state.currentUser.role === "admin" || state.currentUser.role === "responsable_tecnico");
    if (!isAdmin) {
        panel.style.display = "none";
        return;
    }
    
    panel.style.display = "block";
    list.innerHTML = "";
    
    const users = state.vault.users || [];
    const vacations = state.vault.vacations || [];
    const todayStr = new Date().toISOString().split('T')[0];
    
    users.forEach(u => {
        let approvedDays = 0;
        let pendingDays = 0;
        let enjoyedDays = 0;
        
        const userVacations = vacations.filter(v => (v.username || "").toLowerCase() === u.username.toLowerCase());
        userVacations.forEach(v => {
            const bizDays = getBusinessDaysCount(v.dates);
            if (v.status === "approved") {
                approvedDays += bizDays;
                
                // Count enjoyed days (approved and date is in the past)
                const enjoyedBizDays = getBusinessDaysCount(v.dates.filter(d => d < todayStr));
                enjoyedDays += enjoyedBizDays;
            } else if (v.status === "pending") {
                pendingDays += bizDays;
            }
        });
        
        const year = state.vacation.currentDate.getFullYear();
        const allowance = getUserVacationAllowance(u, year);
        const remainingDays = allowance - approvedDays - pendingDays;
        const color = getTechColor(u.username);
        const displayName = u.fullName || u.username.toUpperCase();
        
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.background = "rgba(255, 255, 255, 0.02)";
        item.style.border = "1px solid var(--border-glass)";
        item.style.borderRadius = "var(--radius-sm)";
        item.style.padding = "8px 12px";
        item.style.fontSize = "0.85rem";
        
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:12px; height:12px; border-radius:50%; background:${color}; display:inline-block; border:1px solid rgba(255,255,255,0.2);"></span>
                <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(displayName)}</span>
            </div>
            <div style="display:flex; gap:12px; color:var(--text-secondary); font-size:0.75rem;">
                <span title="Disfrutados"><i class="bx bx-calendar-check" style="color:var(--success);"></i> ${enjoyedDays}</span>
                <span title="Aprobados"><i class="bx bx-check-double" style="color:var(--success);"></i> ${approvedDays}</span>
                <span title="Pendientes"><i class="bx bx-time-five" style="color:var(--warning);"></i> ${pendingDays}</span>
                <span title="Restantes (saldo)"><i class="bx bx-calculator" style="color:var(--accent);"></i> ${remainingDays} (de ${allowance})</span>
            </div>
        `;
        list.appendChild(item);
    });
}

// Debounce helper to optimize search input event rendering
function debounce(func, delay = 250) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}



