// db.js - Erweiterte Datenbank mit Teilnehmerverwaltung und Event-Durchführung
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// Standard-Datenbankstruktur
const defaultDb = {
    users: [
        {
            id: 1,
            name: 'Admin',
            email: 'admin@angel-event.de',
            password: '$2a$10$dummyhash', // wird später ersetzt
            role: 'admin',
            phone: '',
            createdAt: new Date().toISOString()
        }
    ],
    events: [
        {
            id: 1,
            title: 'Hecht-Cup 2026',
            date: '2026-05-15',
            location: 'Müggelsee, Berlin',
            description: 'Traditionsreicher Hecht-Wettkampf mit tollen Preisen.',
            price: 25,
            image: 'fas fa-water',
            maxParticipants: 20,
            spots: 10,
            currentParticipants: 0,
            participants: [], // wird jetzt Array von Objekten { userId, paymentMethod, paid }
            participantOrder: [],
            participantSpots: {},
            catches: {},
            rounds: [],
            currentRound: 0,
            createdAt: new Date().toISOString(),
            createdBy: 1
        },
        {
            id: 2,
            title: 'Karpfen-Meisterschaft',
            date: '2026-06-22',
            location: 'Chiemsee, Bayern',
            description: 'Das größte Karpfentreffen im Süden.',
            price: 30,
            image: 'fas fa-fish',
            maxParticipants: 30,
            spots: 15,
            currentParticipants: 0,
            participants: [],
            participantOrder: [],
            participantSpots: {},
            catches: {},
            rounds: [],
            currentRound: 0,
            createdAt: new Date().toISOString(),
            createdBy: 1
        },
        {
            id: 3,
            title: 'Seeangeln auf Zander',
            date: '2026-07-10',
            location: 'Bodensee',
            description: 'Vom Boot aus auf Zander – für erfahrene Angler.',
            price: 40,
            image: 'fas fa-ship',
            maxParticipants: 15,
            spots: 8,
            currentParticipants: 0,
            participants: [],
            participantOrder: [],
            participantSpots: {},
            catches: {},
            rounds: [],
            currentRound: 0,
            createdAt: new Date().toISOString(),
            createdBy: 1
        }
    ],
    resetTokens: [] // für Passwort-Reset
};

// Lade Datenbank
function loadDb() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        } else {
            saveDb(defaultDb);
            return defaultDb;
        }
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        return defaultDb;
    }
}

// Speichere Datenbank
function saveDb(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        return false;
    }
}

// ========== BENUTZER-FUNKTIONEN ==========
function getAllUsers() {
    const db = loadDb();
    return db.users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        createdAt: user.createdAt
    }));
}

function findUserByEmail(email) {
    const db = loadDb();
    return db.users.find(u => u.email === email);
}

function findUserById(id) {
    const db = loadDb();
    return db.users.find(u => u.id === parseInt(id));
}

function createUser(userData) {
    const db = loadDb();
    const newUser = {
        id: db.users.length + 1,
        ...userData,
        phone: userData.phone || '',
        createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    saveDb(db);
    return newUser;
}

function updateUser(id, userData) {
    const db = loadDb();
    const index = db.users.findIndex(u => u.id === parseInt(id));
    if (index !== -1) {
        db.users[index] = { ...db.users[index], ...userData };
        saveDb(db);
        return db.users[index];
    }
    return null;
}

function deleteUser(id) {
    const db = loadDb();
    const index = db.users.findIndex(u => u.id === parseInt(id));
    if (index !== -1) {
        // Prüfen ob User in Events ist (anhand der userId in participants-Objekten)
        const userInEvents = db.events.some(e => 
            e.participants && e.participants.some(p => p.userId === parseInt(id))
        );
        if (userInEvents) {
            return { error: 'Benutzer ist in Events angemeldet' };
        }
        db.users.splice(index, 1);
        saveDb(db);
        return { success: true };
    }
    return { error: 'Benutzer nicht gefunden' };
}

// ========== EVENT-FUNKTIONEN ==========
function getAllEvents() {
    const db = loadDb();
    return db.events;
}

function getEventById(id) {
    const db = loadDb();
    return db.events.find(e => e.id === parseInt(id));
}

function createEvent(eventData, userId) {
    const db = loadDb();
    const newEvent = {
        id: db.events.length + 1,
        ...eventData,
        maxParticipants: parseInt(eventData.maxParticipants) || 20,
        spots: parseInt(eventData.spots) || 10,
        currentParticipants: 0,
        participants: [],
        participantOrder: [],
        participantSpots: {},
        catches: {},
        rounds: [],
        currentRound: 0,
        createdAt: new Date().toISOString(),
        createdBy: userId
    };
    db.events.push(newEvent);
    saveDb(db);
    return newEvent;
}

function updateEvent(id, eventData) {
    const db = loadDb();
    const index = db.events.findIndex(e => e.id === parseInt(id));
    if (index !== -1) {
        const existing = db.events[index];
        if (!existing.participants) existing.participants = [];
        const currentParticipants = existing.participants.length;

        db.events[index] = {
            ...existing,
            ...eventData,
            maxParticipants: parseInt(eventData.maxParticipants) || existing.maxParticipants || 20,
            spots: parseInt(eventData.spots) || existing.spots || 10,
            participants: existing.participants,
            participantOrder: existing.participantOrder || [],
            participantSpots: existing.participantSpots || {},
            catches: existing.catches || {},
            rounds: existing.rounds || [],
            currentRound: existing.currentRound || 0,
            currentParticipants: currentParticipants
        };
        saveDb(db);
        return db.events[index];
    }
    return null;
}

function deleteEvent(id) {
    const db = loadDb();
    const index = db.events.findIndex(e => e.id === parseInt(id));
    if (index !== -1) {
        db.events.splice(index, 1);
        saveDb(db);
        return true;
    }
    return false;
}

// ========== TEILNEHMER-VERWALTUNG (erweitert) ==========

// Gibt Teilnehmer eines Events mit allen Details zurück
function getEventParticipants(eventId) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return [];
    if (!event.participants) event.participants = [];

    return event.participants.map(p => {
        const user = db.users.find(u => u.id === p.userId);
        return user ? {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            paymentMethod: p.paymentMethod,
            paid: p.paid
        } : null;
    }).filter(p => p !== null);
}

// Benutzer zu Event hinzufügen mit Zahlungsmethode
function addParticipantToEvent(eventId, userId, paymentMethod = 'cash') {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    const user = db.users.find(u => u.id === parseInt(userId));

    if (!event) return { error: 'Event nicht gefunden' };
    if (!user) return { error: 'Benutzer nicht gefunden' };
    if (!event.participants) event.participants = [];

    // Prüfen ob bereits angemeldet
    if (event.participants.some(p => p.userId === parseInt(userId))) {
        return { error: 'Benutzer bereits angemeldet' };
    }
    // Prüfen ob noch Plätze frei
    if (event.participants.length >= event.maxParticipants) {
        return { error: 'Keine freien Plätze mehr' };
    }
    // Prüfen ob Event bereits gestartet
    if (event.currentRound > 0) {
        return { error: 'Event bereits gestartet, keine Anmeldung mehr möglich' };
    }

    const participant = {
        userId: parseInt(userId),
        paymentMethod,
        paid: false // wird später bei PayPal-Zahlung auf true gesetzt
    };
    event.participants.push(participant);
    event.currentParticipants = event.participants.length;
    saveDb(db);
    return { success: true, event };
}

// Benutzer aus Event entfernen (nur wenn Event nicht gestartet)
function removeParticipantFromEvent(eventId, userId) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return { error: 'Event nicht gefunden' };
    if (!event.participants) event.participants = [];

    const index = event.participants.findIndex(p => p.userId === parseInt(userId));
    if (index === -1) return { error: 'Benutzer nicht im Event' };

    // Nur Stornierung erlauben, wenn Event noch nicht gestartet
    if (event.currentRound > 0) {
        return { error: 'Event bereits gestartet, keine Stornierung möglich' };
    }

    event.participants.splice(index, 1);
    event.currentParticipants = event.participants.length;
    saveDb(db);
    return { success: true, event };
}

// Verfügbare Benutzer für ein Event (noch nicht angemeldet)
function getAvailableUsersForEvent(eventId) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return [];
    if (!event.participants) event.participants = [];

    const participantUserIds = event.participants.map(p => p.userId);
    return db.users
        .filter(user => !participantUserIds.includes(user.id))
        .map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || ''
        }));
}

// NEU: Alle Events, an denen ein bestimmter Benutzer teilnimmt (mit Zahlungsstatus)
function getUserEvents(userId) {
    const db = loadDb();
    const uid = parseInt(userId);
    return db.events.filter(event => 
        event.participants && event.participants.some(p => p.userId === uid)
    ).map(event => {
        const participant = event.participants.find(p => p.userId === uid);
        return {
            ...event,
            userPaymentMethod: participant.paymentMethod,
            userPaid: participant.paid
        };
    });
}

// NEU: Zahlungsstatus aktualisieren (z.B. nach PayPal-Zahlung)
function updateParticipantPayment(eventId, userId, paidStatus) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return { error: 'Event nicht gefunden' };
    if (!event.participants) return { error: 'Keine Teilnehmer' };

    const participant = event.participants.find(p => p.userId === parseInt(userId));
    if (!participant) return { error: 'Benutzer nicht im Event' };

    participant.paid = paidStatus;
    saveDb(db);
    return { success: true };
}

// ========== EVENT-DURCHFÜHRUNG ==========

// Hilfsfunktion: Platziert Angler aus participantOrder auf Plätze
function assignSpots(event) {
    const order = event.participantOrder;
    const spots = event.spots;
    const participantSpots = {};

    for (let i = 0; i < spots; i++) {
        const leftIdx = i * 2;
        const rightIdx = i * 2 + 1;
        if (leftIdx < order.length) {
            participantSpots[order[leftIdx]] = { spot: i + 1, side: 'left' };
        }
        if (rightIdx < order.length) {
            participantSpots[order[rightIdx]] = { spot: i + 1, side: 'right' };
        }
    }
    event.participantSpots = participantSpots;
}

// Event starten (zufällige Startreihenfolge)
function startEvent(eventId) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return { error: 'Event nicht gefunden' };
    if (event.participants.length === 0) return { error: 'Keine Teilnehmer' };
    if (event.currentRound > 0) return { error: 'Event bereits gestartet' };

    // Zufällige Reihenfolge der Teilnehmer-IDs (aus den Objekten)
    const participantIds = event.participants.map(p => p.userId);
    const shuffled = [...participantIds].sort(() => Math.random() - 0.5);

    event.participantOrder = shuffled;
    event.currentRound = 1;
    event.rounds = [{ round: 1, started: new Date().toISOString(), finished: null }];
    event.catches = {};

    assignSpots(event);

    saveDb(db);
    return { success: true, event };
}

// Fang eines Anglers aktualisieren
function updateCatch(eventId, userId, round, amount) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return { error: 'Event nicht gefunden' };
    if (!event.catches) event.catches = {};
    if (!event.catches[userId]) event.catches[userId] = {};
    event.catches[userId][`round${round}`] = amount;
    saveDb(db);
    return { success: true };
}

// Nächste Runde starten (Rotation um eine Position im Uhrzeigersinn)
function nextRound(eventId) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return { error: 'Event nicht gefunden' };
    if (event.currentRound === 0) return { error: 'Event nicht gestartet' };
    if (event.currentRound === -1) return { error: 'Event bereits beendet' };

    const currentRoundIndex = event.rounds.findIndex(r => r.round === event.currentRound);
    if (currentRoundIndex !== -1) {
        event.rounds[currentRoundIndex].finished = new Date().toISOString();
    }

    const order = event.participantOrder;
    if (order.length > 0) {
        const last = order.pop();
        order.unshift(last);
    }

    event.currentRound += 1;
    event.rounds.push({ round: event.currentRound, started: new Date().toISOString(), finished: null });

    assignSpots(event);

    saveDb(db);
    return { success: true, currentRound: event.currentRound };
}

// Event beenden
function finishEvent(eventId) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return { error: 'Event nicht gefunden' };
    event.currentRound = -1;
    saveDb(db);
    return { success: true };
}

// Statistik berechnen
function getEventStats(eventId) {
    const db = loadDb();
    const event = db.events.find(e => e.id === parseInt(eventId));
    if (!event) return [];

    const stats = [];
    for (const p of event.participants) {
        const userId = p.userId;
        const user = db.users.find(u => u.id === userId);
        if (!user) continue;
        const catches = event.catches[userId] || {};
        let total = 0;
        for (const round in catches) {
            total += catches[round] || 0;
        }
        stats.push({
            userId,
            name: user.name,
            total,
            catches
        });
    }
    stats.sort((a, b) => b.total - a.total);
    return stats;
}

// ========== PASSWORT-RESET ==========
function createResetToken(email) {
    const db = loadDb();
    if (!db.resetTokens) db.resetTokens = [];
    db.resetTokens = db.resetTokens.filter(t => t.email !== email);
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000; // 1 Stunde
    db.resetTokens.push({ email, token, expires, used: false });
    saveDb(db);
    return token;
}

function findResetToken(token) {
    const db = loadDb();
    if (!db.resetTokens) return null;
    return db.resetTokens.find(t => t.token === token && t.expires > Date.now() && !t.used);
}

function markTokenAsUsed(token) {
    const db = loadDb();
    if (!db.resetTokens) return false;
    const index = db.resetTokens.findIndex(t => t.token === token);
    if (index !== -1) {
        db.resetTokens[index].used = true;
        saveDb(db);
        return true;
    }
    return false;
}

// ========== EXPORTS ==========
module.exports = {
    // User
    getAllUsers,
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    deleteUser,

    // Events
    getAllEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,

    // Teilnehmer (erweitert)
    getEventParticipants,
    addParticipantToEvent,
    removeParticipantFromEvent,
    getAvailableUsersForEvent,
    getUserEvents,
    updateParticipantPayment,

    // Event-Durchführung
    startEvent,
    updateCatch,
    nextRound,
    finishEvent,
    getEventStats,

    // Passwort-Reset
    createResetToken,
    findResetToken,
    markTokenAsUsed
};
