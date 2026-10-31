/* ==========================================================
   api.js – Frontend-Logik
   Aufbau:
   1. Konfiguration (Endpunkte)
   2. Hilfsfunktionen (Fetch, Meldungen, Tabellen, Modals)
   3. Ansichten (Login / Admin / Projektleiter / Mitarbeiter / Common)
   4. Login und Logout
   5. Admin
   6. Projektleiter
   7. Mitarbeiter
   8. Common (eigenes Passwort)
   9. Start
   ========================================================== */

/* ==========================================================
   1. KONFIGURATION
   Alle Endpunkte an einer Stelle: Pfad hier ändern, fertig.
   ========================================================== */
const API = {
    // Anmeldung
    login: "/api/login",
    logout: "/api/logout",

    // Listen (GET)
    users: "/api/users",
    persons: "/api/persons",
    projects: "/api/projects",
    tasks: "/api/tasks",
    statuses: "/api/status",
    rolle: "/api/rolle",

    // Aktionen (POST)
    userCreate: "/api/admin-create",
    userEdit: "/api/admin-edit",
    projectCreate: "/api/project-create",
    projectEdit: "/api/project-edit",
    projectArchive: "/api/project-archive",
    personToProject: "/api/person-to-project",
    taskCreate: "/api/aufgabe-erstellen",
    taskEdit: "/api/aufgabe-bearbeiten",
    taskStatus: "/api/aufgabe-status"
};

// Wer ist gerade eingeloggt? { person_id, name, rolle }
let currentUser = null;
let currentProjekt= null;

/* ==========================================================
   2. HILFSFUNKTIONEN
   ========================================================== */
const $ = (id) => document.getElementById(id);

/* --- Meldungen (<p role="alert">) --- */
function setMessage(id, text = "", success = false) {
    const element = $(id);
    if (!element) return;
    element.textContent = text;
    element.classList.toggle("success", success);
}

/* --- Fetch --- */
async function apiRequest(url, { method = "GET", body, redirectOn401 = true } = {}) {
    const options = { method, headers: {}, credentials: "same-origin" };

    if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        console.error(error);
        throw new Error("Server nicht erreichbar");
    }

    let data = null;
    try {
        data = await response.json();
    } catch {
        // Antwort ohne JSON, data bleibt null
    }

    if (!response.ok) {
        // Session abgelaufen: zurück zum Login
        if (response.status === 401 && redirectOn401) {
            resetToLogin("Sitzung abgelaufen, bitte neu anmelden");
        }
        throw new Error((data && data.message) || "Fehler (" + response.status + ")");
    }
    return data;
}

const get = (url) => apiRequest(url);
const post = (url, body, options = {}) => apiRequest(url, { method: "POST", body, ...options });

/* --- Formulare: preventDefault, Meldung leeren, Fehler anzeigen --- */
function handleForm(formId, messageId, run) {
    $(formId).addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage(messageId);
        try {
            await run();
        } catch (error) {
            setMessage(messageId, error.message);
        }
    });
}

/* "Schließen"-Button bei Formularen ohne Modal: Formular leeren */
function wireFormClose(buttonId, formId, messageId) {
    $(buttonId).addEventListener("click", () => {
        $(formId).reset();
        setMessage(messageId);
    });
}

/* --- Modals --- */
function openModal(id) {
    $(id).hidden = false;
}

function closeModal(id) {
    $(id).hidden = true;
}

function wireModalClose(buttonId, modalId, messageId) {
    $(buttonId).addEventListener("click", () => {
        closeModal(modalId);
        setMessage(messageId);
    });
}

/* --- Tabellen --- */
function actionButton(label, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        handler();
    });
    return button;
}

function renderTable(tbodyId, items, columns, buildActions = null, onRowClick = null) {
    const tbody = $(tbodyId);
    tbody.replaceChildren();

    items.forEach((item) => {
        const tr = document.createElement("tr");

        columns.forEach((key) => {
            const td = document.createElement("td");
            td.textContent = item[key] ?? "";   // textContent statt innerHTML: kein XSS
            tr.appendChild(td);
        });

        if (buildActions) {
            const td = document.createElement("td");
            buildActions(item).forEach((button) => td.appendChild(button));
            tr.appendChild(td);
        }

        if (onRowClick) {
            tr.addEventListener("click", () => onRowClick(item));
        }
        tbody.appendChild(tr);
    });
}

/* --- Auswahllisten: erste Option (Platzhalter) bleibt --- */
function fillSelect(select, options) {
    while (select.options.length > 1) {
        select.remove(1);
    }
    options.forEach(({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });
}


/* ==========================================================
   3. ANSICHTEN
   ========================================================== */
const views = {
    login: document.querySelector(".login"),
    admin: document.querySelector(".admin"),
    adminFunctions: document.querySelector(".admin-functions"),
    projektleiter: $("projektleiter-view"),
    mitarbeiter: $("mitarbeiter-view"),
    mitarbeiterAuswahl: $("mitarbeiter-projekt-auswahl"),
    mitarbeiterDetail: $("mitarbeiter-projekt-detail"),
    common: $("common-view"),
    nutzer: $("nutzer-view"),
    nutzerAuswahl: $("nutzer-projekt-auswahl"),
    nutzerDetail: $("nutzer-projekt-detail"),
    projektleiterDetail: $("projektleiter-projekt-detail"),
    projektleiterAuswahl: $("projektleiter-projekt-auswahl")
};
function hideAllViews() {
    Object.values(views).forEach((view) => (view.hidden = true));
}

/* Pro Rolle: welche Bereiche sichtbar sind und was geladen wird */
const roleViews = {
    admin: {
        show() {
            views.admin.hidden = false;
            views.adminFunctions.hidden = false;

        },
        load: () => Promise.all([loadUsers(), loadRolle()])
    },
    projektleiter: {
        show() {
            views.projektleiter.hidden = false;
            views.projektleiterDetail.hidden = true;
            views.projektleiterAuswahl.hidden = false;
        },
        load: () => Promise.all([loadProjects(), loadPersons()])
    },
    mitarbeiter: {
        show() {
            views.mitarbeiter.hidden = false;
            // Start immer in der Projektauswahl, die Projektansicht bleibt zu
            views.mitarbeiterAuswahl.hidden = false;
        },
        load: async () => {
            await loadStatuses();
            await loadMitarbeiterProjects();
        }
    },
    nutzer: {
        show() {
            views.nutzer.hidden = false;
            views.nutzerAuswahl.hidden = false;
        },
        load: () => loadNutzerProjects()
    }
};

async function enterApp(user) {
    const rolle = String(user.rolle).toLowerCase();
    const roleView = roleViews[rolle];

    if (!roleView) {
        // Unbekannte Rolle: Session wieder beenden
        post(API.logout, undefined, { redirectOn401: false }).catch(() => {});
        throw new Error("Unbekannte Rolle: " + user.rolle);
    }

    currentUser = user;
    hideAllViews();
    roleView.show();
    views.common.hidden = false;
    await roleView.load();
}

/* Alles zurücksetzen und Login anzeigen */
function resetToLogin(message = "") {
    currentUser = null;
    currentProjekt = null;

    document.querySelectorAll("form").forEach((form) => form.reset());
    document.querySelectorAll("tbody").forEach((tbody) => tbody.replaceChildren());
    document.querySelectorAll(".modal").forEach((modal) => (modal.hidden = true));
    document.querySelectorAll(".password-wrapper input").forEach((input) => (input.type = "password"));
    document.querySelectorAll('p[role="alert"]').forEach((p) => {
        p.textContent = "";
        p.classList.remove("success");
    });

    hideAllViews();
    views.login.hidden = false;
    setMessage("login-message", message);
}


/* ==========================================================
   4. LOGIN UND LOGOUT
   ========================================================== */
async function login(event) {
    event.preventDefault();

    const email = $("email-lc").value.trim();
    const password = $("password_l-c").value;

    setMessage("login-message");

    try {
        // Bei falschen Zugangsdaten antwortet der Server mit 401:
        // das ist hier kein "Session abgelaufen"
        const user = await post(API.login, { email, password }, { redirectOn401: false });
        await enterApp(user);
    } catch (error) {
        console.error(error);
        setMessage("login-message", error.message);
    }
}

async function logout() {
    try {
        await post(API.logout, undefined, { redirectOn401: false });
    } catch (error) {
        console.error(error);
    }
    resetToLogin();
}


/* ==========================================================
   5. ADMIN
   ========================================================== */
async function loadUsers() {
    try {
        const users = await get(API.users);
        renderTable("userTable", users, ["person_id", "nachname"], null, openEditUser);
    } catch (error) {
        setMessage("create-user-message", error.message);
    }
}

async function loadRolle(){
    try {
        const rollen = await get(API.rolle);
        fillSelect(
            $("admin-assign-rolle-person"),
            rollen.map((r) => { const name = typeof r === "string" ? r: r.rolle;
            return {value: name, label: name};
            })
        );
    } catch (error) {
        setMessage("create-user-message", error.message);
    }
}
    


function openEditUser(user) {
    $("admin-edit-person-id").value = user.person_id;
    $("admin-edit-person-email").value = user.email ?? "";
    $("admin-edit-person-rolle").value = user.rolle ?? "";
    setMessage("admin-edit-person-message");
    openModal("admin-edit-person-modal");
}

function initAdmin() {
    handleForm("userFormCreate", "create-user-message", async () => {
        const data = await post(API.userCreate, {
            vorname: $("vorname").value.trim(),
            nachname: $("nachname").value.trim(),
            email: $("email-af").value.trim(),
            rolle: $("admin-assign-rolle-person").value.trim(),
            password: $("password_a-f").value
        });
        $("userFormCreate").reset();
        setMessage("create-user-message", data.message, true);
        await loadUsers();
    });
    wireFormClose("closeModalCreate", "userFormCreate", "create-user-message");

    handleForm("admin-edit-person-form", "admin-edit-person-message", async () => {
        const data = await post(API.userEdit, {
            person_id: Number($("admin-edit-person-id").value),
            email: $("admin-edit-person-email").value.trim(),
            rolle: $("admin-edit-person-rolle").value.trim()
        });
        closeModal("admin-edit-person-modal");
        setMessage("create-user-message", data.message, true);
        await loadUsers();
    });
    wireModalClose("admin-edit-person-close", "admin-edit-person-modal", "admin-edit-person-message");
}


/* ==========================================================
   6. PROJEKTLEITER
   ========================================================== */
async function loadProjects() {
    try {
        const projects = await get(API.projects);

        renderTable(
            "projektleiter-projekt-tbody",
            projects,
            ["projekt_id", "titel", "beschreibung", "status"],
            (projekt) => [
                actionButton("Bearbeiten", () => openEditProject(projekt)),
                actionButton("Archivieren", () => openArchiveProject(projekt))
            ],
            openProjectProjektleiter
        );

        fillSelect(
            $("projektleiter-assign-person-projekt"),
            projects.map((p) => ({ value: p.projekt_id, label: p.titel }))
        );
    } catch (error) {
        setMessage("projektleiter-projekt-list-message", error.message);
    }
}

async function loadPersons() {
    try {
        const persons = await get(API.persons);
        fillSelect(
            $("projektleiter-assign-person-person"),
            persons.map((p) => ({ value: p.person_id, label: p.vorname + " " + p.nachname }))
        );
    } catch (error) {
        setMessage("projektleiter-assign-person-message", error.message);
    }
}

function openEditProject(projekt) {
    $("projektleiter-edit-projekt-id").value = projekt.projekt_id;
    $("projektleiter-edit-projekt-titel").value = projekt.titel ?? "";
    $("projektleiter-edit-projekt-beschreibung").value = projekt.beschreibung ?? "";
    setMessage("projektleiter-edit-projekt-message");
    openModal("projektleiter-edit-projekt-modal");
}

function openArchiveProject(projekt) {
    $("projektleiter-archive-projekt-id").value = projekt.projekt_id;
    $("projektleiter-archive-projekt-titel").textContent = projekt.titel;
    setMessage("projektleiter-archive-projekt-message");
    openModal("projektleiter-archive-projekt-modal");
}

function initProjektleiter() {
    // Projekt erstellen
    handleForm("projektleiter-create-projekt-form", "projektleiter-create-projekt-message", async () => {
        const data = await post(API.projectCreate, {
            titel: $("projektleiter-create-projekt-titel").value.trim(),
            beschreibung: $("projektleiter-create-projekt-beschreibung").value.trim()
        });
        $("projektleiter-create-projekt-form").reset();
        setMessage("projektleiter-create-projekt-message", data.message, true);
        await loadProjects();
    });
    wireFormClose(
        "projektleiter-create-projekt-close",
        "projektleiter-create-projekt-form",
        "projektleiter-create-projekt-message"
    );

    // Projekt bearbeiten
    handleForm("projektleiter-edit-projekt-form", "projektleiter-edit-projekt-message", async () => {
        const data = await post(API.projectEdit, {
            projekt_id: Number($("projektleiter-edit-projekt-id").value),
            titel: $("projektleiter-edit-projekt-titel").value.trim(),
            beschreibung: $("projektleiter-edit-projekt-beschreibung").value.trim()
        });
        closeModal("projektleiter-edit-projekt-modal");
        setMessage("projektleiter-projekt-list-message", data.message, true);
        await loadProjects();
    });
    wireModalClose(
        "projektleiter-edit-projekt-close",
        "projektleiter-edit-projekt-modal",
        "projektleiter-edit-projekt-message"
    );

    // Projekt archivieren
    handleForm("projektleiter-archive-projekt-form", "projektleiter-archive-projekt-message", async () => {
        const data = await post(API.projectArchive, {
            projekt_id: Number($("projektleiter-archive-projekt-id").value)
        });
        closeModal("projektleiter-archive-projekt-modal");
        await loadProjects();
        setMessage("projektleiter-projekt-list-message", data.message, true);
    });
    wireModalClose(
        "projektleiter-archive-projekt-close",
        "projektleiter-archive-projekt-modal",
        "projektleiter-archive-projekt-message"
    );

    // Person einem Projekt zuweisen
    handleForm("projektleiter-assign-person-form", "projektleiter-assign-person-message", async () => {
        const data = await post(API.personToProject, {
            projekt_id: Number($("projektleiter-assign-person-projekt").value),
            person_id: Number($("projektleiter-assign-person-person").value)
        });
        $("projektleiter-assign-person-form").reset();
        setMessage("projektleiter-assign-person-message", data.message, true);
    });
    wireFormClose(
        "projektleiter-assign-person-close",
        "projektleiter-assign-person-form",
        "projektleiter-assign-person-message"
    );
$("projektleiter-projekt-zurueck").addEventListener("click", closeProjectProjektleiter);

}

async function openProjectProjektleiter(projekt) {
    currentProjekt = projekt;
    views.projektleiterAuswahl.hidden = true;
    views.projektleiterDetail.hidden = false;
    $("projektleiter-projekt-detail-titel").textContent = projekt.titel;
    setMessage("projektleiter-aufgabe-list-message");
    await loadTasksProjektleiter();
}

function closeProjectProjektleiter() {
    currentProjekt = null;
    $("projektleiter-aufgabe-tbody").replaceChildren();
    views.projektleiterDetail.hidden = true;
    views.projektleiterAuswahl.hidden = false;
    setMessage("projektleiter-aufgabe-list-message");
}

async function loadTasksProjektleiter() {
    if (!currentProjekt) return;
    try {
        const tasks = await get(API.tasks + "?projekt_id=" + encodeURIComponent(currentProjekt.projekt_id));

        renderTable(
            "projektleiter-aufgabe-tbody",
            tasks,
            ["aufgabe_id", "titel", "beschreibung", "status"],
        );
    } catch (error) {
        setMessage("projektleiter-aufgabe-list-message", error.message);
    }
}
/* ==========================================================
   7. MITARBEITER
   ========================================================== */
async function loadStatuses() {
    try {
        const statuses = await get(API.statuses);   // z. B. ["offen", "in Arbeit", "erledigt"]
        const options = statuses.map((s) => {
            const name = typeof s === "string" ? s : s.status;
            return { value: name, label: name };
        });
        fillSelect($("mitarbeiter-create-aufgabe-status"), options);
        fillSelect($("mitarbeiter-change-aufgabe-status-select"), options);
    } catch (error) {
        setMessage("mitarbeiter-create-aufgabe-message", error.message);
    }
}

async function loadMitarbeiterProjects() {
    setMessage("mitarbeiter-projekt-list-message");
    try {
        const projects = await get(API.projects);

        // Zeilenklick öffnet das Projekt (kein Aktionen-Button nötig)
        renderTable(
            "mitarbeiter-projekt-tbody",
            projects,
            ["projekt_id", "titel", "beschreibung"],
            null,
            openProject
        );

        if (projects.length === 0) {
            setMessage("mitarbeiter-projekt-list-message", "Dir sind noch keine Projekte zugewiesen.");
        }
    } catch (error) {
        setMessage("mitarbeiter-projekt-list-message", error.message);
    }
}

async function openProject(projekt) {
    currentProjekt = projekt;
    views.mitarbeiterAuswahl.hidden = true;
    views.mitarbeiterDetail.hidden = false;
    $("mitarbeiter-projekt-detail-titel").textContent = projekt.titel;
    setMessage("mitarbeiter-aufgabe-list-message");
    await loadTasks();
}

function closeProject() {
    currentProjekt = null;
    $("mitarbeiter-aufgabe-tbody").replaceChildren();
    $("mitarbeiter-create-aufgabe-form").reset();
    setMessage("mitarbeiter-create-aufgabe-message");
    views.mitarbeiterDetail.hidden = true;
    views.mitarbeiterAuswahl.hidden = false;
}

async function loadTasks() {
    if (!currentProjekt) return;
    try {
        const tasks = await get(API.tasks + "?projekt_id=" + encodeURIComponent(currentProjekt.projekt_id));

        renderTable(
            "mitarbeiter-aufgabe-tbody",
            tasks,
            ["aufgabe_id", "titel", "beschreibung", "status"],
            (aufgabe) => [
                actionButton("Bearbeiten", () => openEditTask(aufgabe)),
                actionButton("Status ändern", () => openChangeStatus(aufgabe))
            ]
        );
    } catch (error) {
        setMessage("mitarbeiter-aufgabe-list-message", error.message);
    }
}

function openEditTask(aufgabe) {
    $("mitarbeiter-edit-aufgabe-id").value = aufgabe.aufgabe_id;
    $("mitarbeiter-edit-aufgabe-titel").value = aufgabe.titel ?? "";
    $("mitarbeiter-edit-aufgabe-beschreibung").value = aufgabe.beschreibung ?? "";
    setMessage("mitarbeiter-edit-aufgabe-message");
    openModal("mitarbeiter-edit-aufgabe-modal");
}

function openChangeStatus(aufgabe) {
    $("mitarbeiter-change-aufgabe-status-id").value = aufgabe.aufgabe_id;
    $("mitarbeiter-change-aufgabe-status-select").value = aufgabe.status;
    setMessage("mitarbeiter-change-aufgabe-status-message");
    openModal("mitarbeiter-change-aufgabe-status-modal");
}

function initMitarbeiter() {
    // Zurück zur Projektauswahl
    $("mitarbeiter-projekt-zurueck").addEventListener("click", closeProject);
    // Aufgabe erstellen
    handleForm("mitarbeiter-create-aufgabe-form", "mitarbeiter-create-aufgabe-message", async () => {
        const data = await post(API.taskCreate, {
            projekt_id: currentProjekt.projekt_id,
            titel: $("mitarbeiter-create-aufgabe-titel").value.trim(),
            beschreibung: $("mitarbeiter-create-aufgabe-beschreibung").value.trim(),
            status: $("mitarbeiter-create-aufgabe-status").value
        });
        $("mitarbeiter-create-aufgabe-form").reset();
        setMessage("mitarbeiter-create-aufgabe-message", data.message, true);
        await loadTasks();
    });
    wireFormClose(
        "mitarbeiter-create-aufgabe-close",
        "mitarbeiter-create-aufgabe-form",
        "mitarbeiter-create-aufgabe-message"
    );

    // Aufgabe bearbeiten
    handleForm("mitarbeiter-edit-aufgabe-form", "mitarbeiter-edit-aufgabe-message", async () => {
        const data = await post(API.taskEdit, {
            aufgabe_id: Number($("mitarbeiter-edit-aufgabe-id").value),
            titel: $("mitarbeiter-edit-aufgabe-titel").value.trim(),
            beschreibung: $("mitarbeiter-edit-aufgabe-beschreibung").value.trim()
        });
        closeModal("mitarbeiter-edit-aufgabe-modal");
        setMessage("mitarbeiter-aufgabe-list-message", data.message, true);
        await loadTasks();
    });
    wireModalClose(
        "mitarbeiter-edit-aufgabe-close",
        "mitarbeiter-edit-aufgabe-modal",
        "mitarbeiter-edit-aufgabe-message"
    );

    // Status ändern
    handleForm(
        "mitarbeiter-change-aufgabe-status-form",
        "mitarbeiter-change-aufgabe-status-message",
        async () => {
            const data = await post(API.taskStatus, {
                aufgabe_id: Number($("mitarbeiter-change-aufgabe-status-id").value),
                status: $("mitarbeiter-change-aufgabe-status-select").value
            });
            closeModal("mitarbeiter-change-aufgabe-status-modal");
            await loadTasks();
            setMessage("mitarbeiter-aufgabe-list-message", data.message, true);
        }
    );
    wireModalClose(
        "mitarbeiter-change-aufgabe-status-close",
        "mitarbeiter-change-aufgabe-status-modal",
        "mitarbeiter-change-aufgabe-status-message"
    );
}
/* ==========================================================
   7b. NUTZER (nur lesen)
   ========================================================== */
async function loadNutzerProjects() {
    setMessage("nutzer-projekt-list-message");
    try {
        const projects = await get(API.projects);

        renderTable(
            "nutzer-projekt-tbody",
            projects,
            ["projekt_id", "titel", "beschreibung"],
            null,
            openNutzerProject
        );

        if (projects.length === 0) {
            setMessage("nutzer-projekt-list-message", "Dir sind noch keine Projekte zugewiesen.");
        }
    } catch (error) {
        setMessage("nutzer-projekt-list-message", error.message);
    }
}

async function openNutzerProject(projekt) {
    currentProjekt = projekt;
    views.nutzerAuswahl.hidden = true;
    views.nutzerDetail.hidden = false;
    $("nutzer-projekt-detail-titel").textContent = projekt.titel;
    setMessage("nutzer-aufgabe-list-message");
    await loadNutzerTasks();
}

function closeNutzerProject() {
    currentProjekt = null;
    $("nutzer-aufgabe-tbody").replaceChildren();
    setMessage("nutzer-aufgabe-list-message");
    views.nutzerDetail.hidden = true;
    views.nutzerAuswahl.hidden = false;
}

async function loadNutzerTasks() {
    if (!currentProjekt) return;
    try {
        const tasks = await get(API.tasks + "?projekt_id=" + encodeURIComponent(currentProjekt.projekt_id));

        renderTable(
            "nutzer-aufgabe-tbody",
            tasks,
            ["aufgabe_id", "titel", "beschreibung", "status"]
        );

        if (tasks.length === 0) {
            setMessage("nutzer-aufgabe-list-message", "Dieses Projekt hat noch keine Aufgaben.");
        }
    } catch (error) {
        setMessage("nutzer-aufgabe-list-message", error.message);
    }
}

function initNutzer() {
    $("nutzer-projekt-zurueck").addEventListener("click", closeNutzerProject);
}

/* ==========================================================
   8. COMMON (für alle Rollen): eigenes Passwort ändern
   ========================================================== */
function initCommon() {
    handleForm("common-edit-person-form", "common-edit-person-message", async () => {
        const data = await post(API.userEdit, {
            person_id: currentUser.person_id,
            password: $("common-edit-person-password").value
        });
        $("common-edit-person-form").reset();
        setMessage("common-edit-person-message", data.message, true);
    });
    $("common-open-password").addEventListener("click", () => {
    $("common-edit-person-form").reset();
    $("common-edit-person-password").type = "password";
    setMessage("common-edit-person-message");
    openModal("common-edit-person-modal");
    });
    wireModalClose("common-edit-person-close", "common-edit-person-modal", "common-edit-person-message");
    const logoutButton = $("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
}


/* ==========================================================
   9. START
   ========================================================== */
function initPasswordToggles() {
    // Funktioniert für jedes Auge (<span>) neben einem Passwortfeld
    document.querySelectorAll(".password-wrapper span").forEach((toggle) => {
        toggle.addEventListener("click", () => {
            const input = toggle.parentElement.querySelector("input");
            input.type = input.type === "password" ? "text" : "password";
        });
    });
}

document.querySelector(".login-container form").addEventListener("submit", login);

initPasswordToggles();
initAdmin();
initProjektleiter();
initMitarbeiter();
initCommon();
initNutzer();

// Beim Laden ist nur der Login sichtbar
resetToLogin();