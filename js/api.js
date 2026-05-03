// api.js - Zapouzdření Supabase REST API a načítání dat
const API_URL = window.CONFIG.SUPABASE_URL;
const API_KEY = window.CONFIG.SUPABASE_ANON_KEY;

function getHeaders() {
    return {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

export async function fetchSchedule() {
    try {
        const response = await fetch('schedule.json');
        if (!response.ok) throw new Error('Nepodařilo se načíst harmonogram.');
        return await response.json();
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function createUser(user) {
    const url = `${API_URL}/rest/v1/users`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(user)
    });
    const data = await response.json();
    return data && data.length > 0 ? data[0] : null;
}

export async function getSignupsForEvent(eventId) {
    const url = `${API_URL}/rest/v1/signups?event_id=eq.${encodeURIComponent(eventId)}&select=user_id,users(name)`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.map(s => ({
        user_id: s.user_id,
        name: s.users ? s.users.name : 'Neznámý'
    }));
}

export async function getUserSignups(userId) {
    if (!userId) return [];
    const url = `${API_URL}/rest/v1/signups?user_id=eq.${userId}&select=event_id`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(s => s.event_id);
}

export async function toggleSignup(userId, eventId) {
    const url = `${API_URL}/rest/v1/signups?user_id=eq.${userId}&event_id=eq.${eventId}`;
    const getRes = await fetch(url, { headers: getHeaders() });
    const existing = await getRes.json();
    
    if (existing && existing.length > 0) {
        await fetch(url, { method: 'DELETE', headers: getHeaders() });
        return false;
    } else {
        const postUrl = `${API_URL}/rest/v1/signups`;
        await fetch(postUrl, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ user_id: userId, event_id: eventId })
        });
        return true;
    }
}

export async function hasUserSignedUp(userId, eventId) {
    if (!userId) return false;
    const url = `${API_URL}/rest/v1/signups?user_id=eq.${userId}&event_id=eq.${eventId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return false;
    const data = await res.json();
    return data && data.length > 0;
}
