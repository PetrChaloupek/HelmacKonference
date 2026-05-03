import * as api from './api.js';

// --- STAV APLIKACE ---
let state = {
    user: null,
    events: []
};

// --- INICIALIZACE ---
async function init() {
    const savedUser = localStorage.getItem('helmac_user');
    if (savedUser) {
        try {
            state.user = JSON.parse(savedUser);
        } catch (e) {
            console.error('Chyba při čtení localStorage');
        }
    }
    state.events = await api.fetchSchedule();
    window.addEventListener('hashchange', router);
    router();
}

// --- ROUTER ---
async function router() {
    updateNav();
    const hash = window.location.hash || '#/';
    const appDiv = document.getElementById('app');
    appDiv.innerHTML = '<div class="text-center mt-4">Načítání...</div>';

    if (hash === '#/') {
        await renderHome(appDiv);
    } else if (hash.startsWith('#/event/')) {
        const id = hash.split('/')[2];
        await renderEventDetail(appDiv, id);
    } else if (hash === '#/login') {
        renderLogin(appDiv);
    } else {
        appDiv.innerHTML = '<h1 class="page-title">404 - Nenalezeno</h1><p>Stránka neexistuje.</p>';
    }
}

// --- KOMPONENTY / POHLEDY ---

function updateNav() {
    const nav = document.getElementById('nav-user-status');
    if (state.user) {
        nav.innerHTML = `<span>${state.user.name}</span> | <a href="#" id="logout-btn">Změnit jméno</a>`;
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('helmac_user');
            state.user = null;
            window.location.hash = '#/';
            router();
        });
    } else {
        nav.innerHTML = `<a href="#/login">Přihlásit se</a>`;
    }
}

async function renderHome(container) {
    let html = `<h1 class="page-title">Program konference</h1>`;
    if (state.events.length === 0) {
        html += `<p>Žádný program zatím nebyl zveřejněn.</p>`;
    }
    for (const ev of state.events) {
        html += `
            <div class="event-card">
                <span class="event-time">${ev.time} | ${ev.day}</span>
                <h2 class="event-title">${ev.title}</h2>
                <div class="event-meta">
                    <span>Lokalita: ${ev.location}</span>
                </div>
                <a href="#/event/${ev.id}" class="btn mt-2">Detail události a účastníci</a>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function renderEventDetail(container, eventId) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) {
        container.innerHTML = `<h1 class="page-title">Událost nenalezena</h1><a href="#/">Zpět na program</a>`;
        return;
    }

    const attendees = await api.getSignupsForEvent(eventId);
    let isSignedUp = false;
    if (state.user) {
        isSignedUp = await api.hasUserSignedUp(state.user.id, eventId);
    }

    let html = `
        <a href="#/" class="mb-2" style="display:inline-block">&larr; Zpět na program</a>
        <h1 class="page-title">${event.title}</h1>
        <p class="event-time">${event.time} | ${event.day}</p>
        <p class="mt-2"><strong>Místo:</strong> ${event.location}</p>
        <p class="event-description">${event.description}</p>
    `;

    if (state.user) {
        const btnClass = isSignedUp ? "btn btn-secondary" : "btn";
        const btnText = isSignedUp ? "Zrušit účast" : "Přihlásit se k účasti";
        html += `
            <div class="mt-4">
                <button id="toggle-signup" class="${btnClass}">${btnText}</button>
            </div>
        `;
    } else {
        html += `
            <div class="mt-4 p-4" style="background:var(--color-gray-200)">
                <p>Abyste se mohli zapsat, prosím <a href="#/login">zadejte své jméno</a>.</p>
            </div>
        `;
    }

    html += `
        <div class="attendee-list">
            <h3>Seznam účastníků (${attendees.length})</h3>
            <ul>
                ${attendees.map(a => `<li>${a.name}</li>`).join('')}
                ${attendees.length === 0 ? '<li>Zatím nikdo. Buďte první!</li>' : ''}
            </ul>
        </div>
    `;

    container.innerHTML = html;

    if (state.user) {
        document.getElementById('toggle-signup').addEventListener('click', async () => {
            document.getElementById('toggle-signup').innerText = "Pracuji...";
            document.getElementById('toggle-signup').disabled = true;
            try {
                await api.toggleSignup(state.user.id, eventId);
                renderEventDetail(container, eventId);
            } catch (e) {
                alert("Nepodařilo se změnit účast.");
                renderEventDetail(container, eventId);
            }
        });
    }
}

function renderLogin(container) {
    if (state.user) {
        window.location.hash = '#/';
        return;
    }

    container.innerHTML = `
        <h1 class="page-title">Vstup na konferenci</h1>
        <p class="mb-4">Zadejte prosím své jméno. Bude sloužit jako vaše vizitka v seznamu účastníků událostí.</p>
        
        <div id="login-alert"></div>
        
        <form id="login-form">
            <div class="form-group">
                <label for="name">Vaše jméno a příjmení</label>
                <input type="text" id="name" required placeholder="Např. Tumi">
            </div>
            <button type="submit" class="btn" id="login-submit">Vstoupit do aplikace</button>
        </form>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const btn = document.getElementById('login-submit');
        const alertBox = document.getElementById('login-alert');
        
        btn.disabled = true;
        btn.innerText = "Zpracovávám...";
        
        try {
            const userObj = {
                id: crypto.randomUUID(),
                name: name
            };
            
            await api.createUser(userObj);
            
            state.user = userObj;
            localStorage.setItem('helmac_user', JSON.stringify(userObj));
            
            window.location.hash = '#/';
        } catch (error) {
            console.error(error);
            alertBox.innerHTML = `<div class="alert alert-error">Chyba: Zkontrolujte spojení s databází (klíče v config.js).</div>`;
            btn.disabled = false;
            btn.innerText = "Zkusit znovu";
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
