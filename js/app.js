import * as api from './api.js';

// --- STAV APLIKACE ---
let state = {
    user: null,
    events: [],
    filter: 'all',
    userSignups: []
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
            state.filter = 'all';
            state.userSignups = [];
            window.location.hash = '#/';
            router();
        });
    } else {
        nav.innerHTML = `<a href="#/login">Přihlásit se</a>`;
    }
}

async function renderHome(container) {
    const titleText = state.filter === 'mine' ? 'Můj osobní program' : 'Archiv programu koňference';
    let html = `<h1 class="page-title">${titleText}</h1>`;

    if (state.user) {
        // Fetch current signups on render to be always up-to-date
        state.userSignups = await api.getUserSignups(state.user.id);
        
        const btnAllClass = state.filter === 'all' ? 'btn btn-active' : 'btn';
        const btnMineClass = state.filter === 'mine' ? 'btn btn-active' : 'btn';
        html += `
            <div class="filter-toggle">
                <button id="filter-all" class="${btnAllClass}">Kompletní program</button>
                <button id="filter-mine" class="${btnMineClass}">Můj program</button>
            </div>
        `;
    }

    let eventsToRender = state.events;

    if (state.filter === 'mine' && state.user) {
        eventsToRender = eventsToRender.filter(ev => state.userSignups.includes(ev.id));
    }

    if (eventsToRender.length === 0) {
        if (state.filter === 'mine') {
            html += `<p>Zatím nejste přihlášeni na žádný bod programu.</p>`;
        } else {
            html += `<p>Žádný program zatím nebyl zveřejněn.</p>`;
        }
    } else {
        const dayOrder = ['Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
        const eventsByDay = {};
        for (const ev of eventsToRender) {
            if (!eventsByDay[ev.day]) eventsByDay[ev.day] = {};
            const startTime = ev.time.split('-')[0].trim();
            if (!eventsByDay[ev.day][startTime]) eventsByDay[ev.day][startTime] = [];
            eventsByDay[ev.day][startTime].push(ev);
        }

        for (const day of dayOrder) {
            if (!eventsByDay[day]) continue;
            
            html += `<h2 class="day-title">${day}</h2><div class="schedule-day">`;

            // Sort start times for each day
            const startTimes = Object.keys(eventsByDay[day]).sort();

            for (const startTime of startTimes) {
                const slots = eventsByDay[day][startTime];
                html += `<div class="time-slot-row">`;
                for (const ev of slots) {
                    const garant = ev.description ? ev.description.replace('Garant: ', '') : '';
                    html += `
                        <div class="event-card">
                            <div class="event-tags">
                                <span class="event-time">${ev.time}</span>
                                ${garant ? `<span class="event-time">${garant}</span>` : ''}
                            </div>
                            <h2 class="event-title">${ev.title}</h2>
                            ${ev.location ? `<div class="event-meta"><span>Lokalita: ${ev.location}</span></div>` : ''}
                            <a href="#/event/${ev.id}" class="btn-link">Detail a účastníci &rarr;</a>
                        </div>
                    `;
                }
                html += `</div>`;
            }
            html += `</div>`;
        }
    }
    container.innerHTML = html;

    if (state.user) {
        document.getElementById('filter-all').addEventListener('click', () => {
            state.filter = 'all';
            renderHome(container);
        });
        document.getElementById('filter-mine').addEventListener('click', () => {
            state.filter = 'mine';
            renderHome(container);
        });
    }
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

    const garant = event.description ? event.description.replace('Garant: ', '') : '';
    let html = `
        <a href="#/" class="mb-2" style="display:inline-block">&larr; Zpět na program</a>
        <h1 class="page-title">${event.title}</h1>
        <div class="event-tags">
            <span class="event-time">${event.time} | ${event.day}</span>
            ${garant ? `<span class="event-time">${garant}</span>` : ''}
        </div>
        ${event.location ? `<p class="mt-2"><strong>Místo:</strong> ${event.location}</p>` : ''}
    `;

    if (state.user) {
        const btnClass = isSignedUp ? "btn" : "btn-primary";
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
        <h1 class="page-title">Vstup na koňferenci</h1>
        <p class="mb-4">Zadejte prosím své jméno. Bude sloužit jako vaše vizitka v seznamu účastníků událostí.</p>
        
        <div id="login-alert"></div>
        
        <form id="login-form">
            <div class="form-group">
                <label for="name">Tvoje přezdívka</label>
                <input type="text" id="name" required placeholder="Např. Hulk">
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
            // Fallback pro lokální testování (kde nemusí fungovat crypto.randomUUID kvůli chybějícímu HTTPS)
            const getUUID = () => {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return crypto.randomUUID();
                }
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            };

            const userObj = {
                id: getUUID(),
                name: name
            };
            
            await api.createUser(userObj);
            
            state.user = userObj;
            localStorage.setItem('helmac_user', JSON.stringify(userObj));
            
            window.location.hash = '#/';
        } catch (error) {
            console.error(error);
            alertBox.innerHTML = `<div class="alert alert-error">Chyba: ${error.message} <br>(Pokud chyba přetrvává, zkontrolujte config.js).</div>`;
            btn.disabled = false;
            btn.innerText = "Zkusit znovu";
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
