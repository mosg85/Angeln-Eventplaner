// server.js - Hauptdatei mit Admin-Panel, Event-Durchführung und Benutzer-Funktionen
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'angel-event-planer-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true für HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ========== MIDDLEWARE FÜR AUTHENTIFIZIERUNG ==========

// Für API-Endpunkte (gibt JSON-Fehler zurück)
function isAuthenticatedAPI(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Nicht eingeloggt' });
    }
}

// Für Seiten-Weiterleitung (HTML)
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('Zugriff verweigert');
    }
}

// ========== AUTHENTIFIZIERUNG ==========

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        const existingUser = db.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'E-Mail bereits registriert' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = db.createUser({
            name,
            email,
            password: hashedPassword,
            role: 'user',
            phone: phone || ''
        });

        res.json({ success: true, message: 'Registrierung erfolgreich' });
    } catch (error) {
        console.error('Registrierungsfehler:', error);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = db.findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Falsche E-Mail oder Passwort' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Falsche E-Mail oder Passwort' });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.json({
            success: true,
            user: { name: user.name, role: user.role },
            redirect: user.role === 'admin' ? '/admin.html' : '/'
        });
    } catch (error) {
        console.error('Login-Fehler:', error);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Nicht eingeloggt' });
    }
});

// ========== EVENT-ROUTEN (allgemein) ==========

// Öffentliche Events (ohne Login-Status)
app.get('/api/events', (req, res) => {
    const events = db.getAllEvents();
    res.json(events);
});

// Events mit Teilnehmerstatus für eingeloggte Benutzer
app.get('/api/events/with-status', isAuthenticatedAPI, (req, res) => {
    const events = db.getAllEvents();
    const userId = req.session.user.id;
    const eventsWithStatus = events.map(event => {
        const participant = event.participants?.find(p => p.userId === userId);
        return {
            ...event,
            userRegistered: !!participant,
            userPaymentMethod: participant?.paymentMethod,
            userPaid: participant?.paid
        };
    });
    res.json(eventsWithStatus);
});

app.get('/api/events/:id', (req, res) => {
    const event = db.getEventById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event nicht gefunden' });

    // Benutzerdaten zu den Teilnehmern holen (für Admin-Ansicht)
    const users = db.getAllUsers();
    // event.participants ist jetzt ein Array von Objekten { userId, paymentMethod, paid }
    const participantsWithData = (event.participants || []).map(p => {
        const user = users.find(u => u.id === p.userId);
        return user ? {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            paymentMethod: p.paymentMethod,
            paid: p.paid
        } : null;
    }).filter(p => p !== null);

    event.participantsData = participantsWithData;
    res.json(event);
});

// ========== ADMIN-ONLY: EVENTS VERWALTEN ==========

app.post('/api/events', isAdmin, (req, res) => {
    try {
        const eventData = req.body;
        const newEvent = db.createEvent(eventData, req.session.user.id);
        res.json({ success: true, event: newEvent });
    } catch (error) {
        console.error('Fehler beim Erstellen:', error);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

app.put('/api/events/:id', isAdmin, (req, res) => {
    try {
        const eventData = req.body;
        const updatedEvent = db.updateEvent(req.params.id, eventData);
        if (updatedEvent) {
            res.json({ success: true, event: updatedEvent });
        } else {
            res.status(404).json({ error: 'Event nicht gefunden' });
        }
    } catch (error) {
        console.error('Fehler beim Aktualisieren:', error);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

app.delete('/api/events/:id', isAdmin, (req, res) => {
    try {
        const deleted = db.deleteEvent(req.params.id);
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Event nicht gefunden' });
        }
    } catch (error) {
        console.error('Fehler beim Löschen:', error);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// ========== ADMIN: TEILNEHMER-VERWALTUNG ==========

app.get('/api/admin/users', isAdmin, (req, res) => {
    const users = db.getAllUsers();
    res.json(users);
});

app.delete('/api/admin/users/:id', isAdmin, (req, res) => {
    const result = db.deleteUser(req.params.id);
    if (result.success) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.get('/api/events/:id/participants', isAdmin, (req, res) => {
    const participants = db.getEventParticipants(req.params.id);
    res.json(participants);
});

app.get('/api/events/:id/available-users', isAdmin, (req, res) => {
    const users = db.getAvailableUsersForEvent(req.params.id);
    res.json(users);
});

app.post('/api/events/:id/participants', isAdmin, (req, res) => {
    const { userId, paymentMethod } = req.body; // optional paymentMethod
    const result = db.addParticipantToEvent(req.params.id, userId, paymentMethod || 'cash');
    if (result.success) {
        res.json({ success: true, event: result.event });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.delete('/api/events/:id/participants/:userId', isAdmin, (req, res) => {
    const result = db.removeParticipantFromEvent(req.params.id, req.params.userId);
    if (result.success) {
        res.json({ success: true, event: result.event });
    } else {
        res.status(400).json({ error: result.error });
    }
});

// ========== EVENT-DURCHFÜHRUNG (ADMIN) ==========

app.post('/api/events/:id/start', isAdmin, (req, res) => {
    const result = db.startEvent(req.params.id);
    if (result.success) {
        res.json({ success: true, event: result.event });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.post('/api/events/:id/catch', isAdmin, (req, res) => {
    const { userId, round, amount } = req.body;
    const result = db.updateCatch(req.params.id, userId, round, amount);
    if (result.success) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.post('/api/events/:id/nextround', isAdmin, (req, res) => {
    const result = db.nextRound(req.params.id);
    if (result.success) {
        res.json({ success: true, currentRound: result.currentRound });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.post('/api/events/:id/finish', isAdmin, (req, res) => {
    const result = db.finishEvent(req.params.id);
    if (result.success) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: result.error });
    }
});

app.get('/api/events/:id/stats', isAdmin, (req, res) => {
    const stats = db.getEventStats(req.params.id);
    res.json(stats);
});

// ========== BENUTZER-EVENTS (NEU) ==========

// Alle Events, an denen der eingeloggte Benutzer teilnimmt
app.get('/api/user/events', isAuthenticatedAPI, (req, res) => {
    const events = db.getUserEvents(req.session.user.id);
    res.json(events);
});

// Benutzer meldet sich für Event an (mit Zahlungsmethode)
app.post('/api/events/:id/register', isAuthenticatedAPI, (req, res) => {
    const { paymentMethod } = req.body; // 'paypal' oder 'cash'
    const eventId = req.params.id;
    const userId = req.session.user.id;

    const event = db.getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event nicht gefunden' });

    // Prüfen, ob Event bereits gestartet
    if (event.currentRound > 0) {
        return res.status(400).json({ error: 'Event bereits gestartet, keine Anmeldung mehr möglich' });
    }

    const result = db.addParticipantToEvent(eventId, userId, paymentMethod || 'cash');
    if (result.success) {
        res.json({ success: true, event: result.event });
    } else {
        res.status(400).json({ error: result.error });
    }
});

// Benutzer sagt Teilnahme ab (nur vor Start)
app.post('/api/events/:id/cancel', isAuthenticatedAPI, (req, res) => {
    const eventId = req.params.id;
    const userId = req.session.user.id;

    const event = db.getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event nicht gefunden' });

    // Prüfen, ob Event bereits gestartet
    if (event.currentRound > 0) {
        return res.status(400).json({ error: 'Event bereits gestartet, keine Stornierung möglich' });
    }

    const result = db.removeParticipantFromEvent(eventId, userId);
    if (result.success) {
        res.json({ success: true, event: result.event });
    } else {
        res.status(400).json({ error: result.error });
    }
});

// Zahlungsstatus aktualisieren (z.B. nach erfolgreicher PayPal-Zahlung)
app.post('/api/events/:id/payment-success', isAuthenticatedAPI, (req, res) => {
    const eventId = req.params.id;
    const userId = req.session.user.id;

    const result = db.updateParticipantPayment(eventId, userId, true);
    if (result.success) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: result.error });
    }
});

// ========== PASSWORT-VERGESSEN ==========

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = db.findUserByEmail(email);
    if (!user) {
        // Aus Sicherheitsgründen immer gleiche Meldung
        return res.json({ success: true, message: 'Wenn die E-Mail existiert, wurde ein Link gesendet.' });
    }

    const token = db.createResetToken(email);
    console.log(`\n🔗 Passwort-Reset-Link: http://localhost:3000/reset-password.html?token=${token}\n`);
    res.json({ success: true, message: 'Link wurde gesendet (siehe Konsole).' });
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    const resetEntry = db.findResetToken(token);
    if (!resetEntry) {
        return res.status(400).json({ error: 'Ungültiger oder abgelaufener Token' });
    }

    const user = db.findUserByEmail(resetEntry.email);
    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.updateUser(user.id, { password: hashedPassword });
    db.markTokenAsUsed(token);

    res.json({ success: true, message: 'Passwort erfolgreich geändert' });
});

// ========== STATISCHE SEITEN ==========

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ========== SERVER START ==========

app.listen(PORT, () => {
    console.log(`✅ Server gestartet auf http://localhost:${PORT}`);
});
