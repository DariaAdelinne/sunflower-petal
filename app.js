const session = require('express-session'); //sistemul de sesiuni
const cookieParser=require('cookie-parser'); //permite aplicatiei sa citeasca cookie-uri din browser
const express = require('express'); //framework web pentru Node.js
const expressLayouts = require('express-ejs-layouts'); //permite utilizarea layout-urilor cu EJS
const bodyParser = require('body-parser'); //middleware pentru parsarea corpului cererilor HTTP
const fs = require('fs'); //modul pentru lucrul cu sistemul de fisiere
const sqlite3 = require('sqlite3').verbose(); //modul pentru lucrul cu bazele de date SQLite
const bcrypt = require('bcryptjs'); //biblioteca pentru hash-uirea parolelor
const validator = require('validator'); //biblioteca pentru validarea și sanitizarea datelor de intrare
const csrf = require('csurf'); //middleware pentru protecția împotriva atacurilor CSRF (Cross-Site Request Forgery)
const rateLimit = require('express-rate-limit'); //middleware pentru limitarea ratei de cereri către server, util pentru prevenirea atacurilor de tip brute-force și DDoS

// Creeaza aplicatia Express pe portul 6789, activeaza citirea cookie-urilor, configureaza sistemul de sesiuni cu un secret, seteaza optiunile pentru cookie-uri si adauga un middleware pentru a face informatiile despre utilizatorul autentificat disponibile in toate vizualizarile EJS.
const app = express();
const port = 6789;
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// Middleware pentru a face informatiile despre utilizatorul autentificat disponibile in toate vizualizarile EJS
app.use((req, res, next) => {
  res.locals.utilizatorAutentificat = req.session.utilizator;
  next();
});

// Rute pentru crearea bazei de date și inserarea datelor, protejate cu middleware-ul esteAdmin pentru a permite accesul doar utilizatorilor cu rolul de admin.
app.get('/creare-bd', esteAdmin, (req, res) => {
  const db = new sqlite3.Database('cumparaturi.db', (err) => {
    if (err) {
      console.error('Eroare la conectarea la baza de date:', err.message);
      return res.redirect('/');
    }

    console.log('Conectat la baza de date cumparaturi.');
  });

  db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS produse (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nume TEXT NOT NULL UNIQUE,
      pret REAL NOT NULL
    )
  `);

  db.close((err) => {
    if (err) {
      console.error('Eroare la închiderea bazei de date:', err.message);
    }

    res.redirect('/');
  });
});
});

// Ruta pentru inserarea datelor în baza de date, verificând mai întâi dacă există deja produse pentru a preveni inserarea duplicatelor. Dacă baza de date a fost deja populată, se setează un cookie cu un mesaj și se redirecționează utilizatorul către pagina principală.
app.get('/inserare-bd', esteAdmin, (req, res) => {
  const db = new sqlite3.Database('cumparaturi.db');

  // Verificăm dacă există deja produse în baza de date pentru a preveni inserarea duplicatelor
  db.get('SELECT COUNT(*) AS total FROM produse', [], (err, row) => {
    if (!err && row.total > 0) {
      db.close();

    res.cookie('mesaj', 'Baza de date a fost deja inserată.', {
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.redirect('/');
  }

    const produse = [
      ['Trandafir roșu', 15.5],
      ['Cactus mic', 25.0],
      ['Orhidee albă', 60.0],
      ['Buchet de lalele', 45.0],
      ['Ghiveci ceramic pentru plante', 30.0]
    ];

    db.serialize(() => {
      // Folosim INSERT OR IGNORE pentru a preveni inserarea duplicatelor în cazul în care ruta este accesată de mai multe ori
      const stmtProduse = db.prepare(`
        INSERT OR IGNORE INTO produse (nume, pret) 
        VALUES (?, ?)
      `);

      produse.forEach((produs) => {
        stmtProduse.run(produs);
      });

      stmtProduse.finalize(() => {
        db.close(() => {
          res.redirect('/');
        });
      });
    });
  });
});

// Configurarea motorului de vizualizare EJS și a directorului pentru vizualizări, adăugarea middleware-ului pentru layout-uri, servirea fișierelor statice din directorul "public" și configurarea body-parser pentru a putea prelucra datele trimise prin formulare.
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware pentru layout-uri; face folderul public; permite citirea request-urilor JSON; permite citirea formularelor HTML
app.use(expressLayouts);
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Funcții auxiliare pentru citirea întrebărilor dintr-un fișier JSON, curățarea textului și a email-urilor, validarea ID-urilor, verificarea rolului de admin, protecția CSRF, citirea utilizatorilor din baza de date și inițializarea bazelor de date pentru utilizatori și blacklist.
function citesteIntrebari(callback) {
  fs.readFile('intrebari.json', (err, data) => {
    if (err) {
      console.error(err);
      callback([]);
      return;
    }

    const intrebari = JSON.parse(data);
    callback(intrebari);
  });
}

// Funcție pentru curățarea textului de intrare, eliminând spațiile inutile și escapând caracterele speciale pentru a preveni atacurile de tip XSS (Cross-Site Scripting).
function curataText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return validator.escape(text.trim());
}

// Funcție pentru curățarea și normalizarea adreselor de email, eliminând spațiile inutile și folosind funcția normalizeEmail din biblioteca validator pentru a standardiza formatul email-urilor.
function curataEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }

  return validator.normalizeEmail(email.trim()) || '';
}

// Funcție pentru validarea ID-urilor, verificând dacă acestea sunt numere întregi pozitive folosind funcția isInt din biblioteca validator.
function esteIdValid(id) {
  return validator.isInt(String(id), { min: 1 });
}

// Middleware pentru verificarea dacă utilizatorul autentificat are rolul de admin. Dacă utilizatorul nu este autentificat, se returnează un răspuns 401 Unauthorized. Dacă utilizatorul este autentificat, dar nu are rolul de admin, se returnează un răspuns 403 Forbidden. Dacă utilizatorul are rolul de admin, se apelează funcția next() pentru a continua procesarea cererii.
function esteAdmin(req, res, next) {
  if (!req.session.utilizator) {
    return res.status(401).send('Trebuie să fii autentificat.');
  }

  if (req.session.utilizator.rol !== 'ADMIN') {
    return res.status(403).send('403 Forbidden - Nu ai acces la pagina de admin.');
  }

  next();
}

// Middleware pentru protecția împotriva atacurilor CSRF, folosind biblioteca csurf. Acest middleware va genera un token CSRF pentru fiecare sesiune și îl va verifica la fiecare cerere POST, PUT, DELETE sau PATCH pentru a se asigura că cererea provine de la utilizatorul autenticat și nu de la un atacator.
const csrfProtection = csrf();

// Funcție pentru citirea utilizatorilor din baza de date SQLite, care se conectează la baza de date "utilizatori.db", execută o interogare pentru a selecta toți utilizatorii și apoi închide conexiunea la baza de date. Rezultatul este transmis printr-un callback.
function citesteUtilizatori(callback) {
  const db = new sqlite3.Database('utilizatori.db', (err) => {
    if (err) {
      console.error('Eroare la conectarea la baza de date utilizatori:', err.message);
      callback([]);
      return;
    }
  });

  db.all('SELECT * FROM utilizatori', [], (err, utilizatori) => {
    if (err) {
      console.error('Eroare la citirea utilizatorilor:', err.message);
      db.close();
      callback([]);
      return;
    }

    db.close();
    callback(utilizatori); // Transmite lista de utilizatori prin callback
  });
}

// Funcție pentru inițializarea bazei de date pentru utilizatori, care creează tabela "utilizatori" dacă nu există deja și apoi verifică dacă există deja utilizatori în tabelă. Dacă există utilizatori, închide conexiunea la baza de date și returnează. Dacă nu există utilizatori, citește un fișier JSON cu utilizatorii și îi inserează în baza de date, apoi închide conexiunea și afișează un mesaj de confirmare.
function initializeazaBazaUtilizatori() {
  const db = new sqlite3.Database('utilizatori.db');

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS utilizatori (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        utilizator TEXT NOT NULL UNIQUE,
        nume TEXT NOT NULL,
        prenume TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        culoare_favorita TEXT,
        noutati INTEGER,
        parolaHash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'USER'
      )
    `);

    db.get('SELECT COUNT(*) AS total FROM utilizatori', [], (err, row) => {
      if (err) {
        console.error('Eroare verificare utilizatori:', err.message);
        db.close();
        return;
      }

      // Dacă există deja utilizatori în baza de date, nu inserăm din nou
      if (row.total > 0) {
        db.close();
        return;
      }

      const utilizatori = JSON.parse(fs.readFileSync('utilizatori.json', 'utf8'));

      const stmt = db.prepare(`
        INSERT INTO utilizatori
        (utilizator, nume, prenume, email, culoare_favorita, noutati, parolaHash, rol)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      utilizatori.forEach((u) => {
        stmt.run([
          u.utilizator,
          u.nume || 'Nume',
          u.prenume || 'Prenume',
          u.email || u.utilizator,
          u.culoare_favorita || '',
          u.noutati ? 1 : 0,
          u.parolaHash,
          u.rol || 'USER'
        ]);
      });

      stmt.finalize(() => {
        db.close();
        console.log('Baza utilizatori.db a fost creată și populată.');
      });
    });
  });
}

// Funcție pentru inițializarea bazei de date pentru blacklist, care creează tabelele "blacklist" și "login_attempts" dacă nu există deja. Tabela "blacklist" este folosită pentru a stoca adresele IP care au accesat pagini inexistente de prea multe ori, iar tabela "login_attempts" este folosită pentru a stoca încercările de autentificare eșuate și blocările temporare ale conturilor.
function initializeazaBlacklist() {
  const db = new sqlite3.Database('blacklist.db');

  db.serialize(() => {
    // §Creăm tabela "blacklist" pentru a stoca adresele IP care au accesat pagini inexistente de prea multe ori, cu câmpuri pentru numărul de încercări 404, nivelul de blocare și timpul până la care IP-ul este blocat.
    db.run(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL UNIQUE,
        incercari404 INTEGER DEFAULT 0,
        nivelBlocare INTEGER DEFAULT 0,
        blocatPanaLa INTEGER DEFAULT 0,
        ultimaIncercare INTEGER DEFAULT 0
      )
    `);

    // Creăm tabela "login_attempts" pentru a stoca încercările de autentificare eșuate și blocările temporare ale conturilor, cu câmpuri pentru numărul de încercări, nivelul de blocare și timpul până la care contul este blocat.
    db.run(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        incercari INTEGER DEFAULT 0,
        nivelBlocare INTEGER DEFAULT 0,
        blocatPanaLa INTEGER DEFAULT 0
      )
    `);
  });

  db.close();
}


// Ruta pentru pagina principală, care citește produsele din baza de date "cumparaturi.db" și le afișează în vizualizarea "index.ejs". De asemenea, verifică dacă există un cookie cu un mesaj și îl transmite către vizualizare, apoi șterge cookie-ul pentru a nu afișa mesajul la următoarea încărcare a paginii.
app.get('/', (req, res) => {
  const mesaj = req.cookies.mesaj; // Verificăm dacă există un cookie cu mesaj și îl stocăm într-o variabilă
  res.clearCookie('mesaj'); // Ștergem cookie-ul pentru a nu afișa mesajul la următoarea încărcare a paginii
  const db = new sqlite3.Database('cumparaturi.db', (err) => { // Conectăm la baza de date "cumparaturi.db" și verificăm dacă conexiunea a fost realizată cu succes. Dacă există o eroare la conectare, afișăm un mesaj de eroare în consolă și redirecționăm utilizatorul către pagina principală cu un mesaj de eroare.
    if (err) {
      console.error('Eroare la conectarea la baza de date:', err.message);

      res.render('index', { // Dacă există o eroare la conectarea la baza de date, afișăm un mesaj de eroare în vizualizarea "index.ejs" și nu afișăm niciun produs.
        utilizatorAutentificat: req.session.utilizator,
        produse: [],
        mesaj: mesaj
      });
    }
  });

  // Citim toate produsele din tabela "produse" și le stocăm într-o variabilă. Dacă există o eroare la citirea produselor, afișăm un mesaj de eroare în consolă și nu afișăm niciun produs în vizualizare.
  db.all('SELECT * FROM produse', [], (err, produse) => {
    if (err) {
      console.error('Eroare la citirea produselor:', err.message);
      produse = [];
    }

    db.close((err) => {
      if (err) {
        console.error('Eroare la închiderea bazei de date:', err.message);
      }

      res.render('index', { // Afișăm produsele în vizualizarea "index.ejs", împreună cu informațiile despre utilizatorul autentificat și mesajul de eroare (dacă există).
        utilizatorAutentificat: req.session.utilizator,
        produse: produse,
        mesaj: mesaj
      });
    });
  });
});

// Ruta pentru adăugarea unui produs în coșul de cumpărături, care verifică dacă utilizatorul este autentificat și dacă ID-ul produsului este valid. Dacă utilizatorul nu este autentificat, se returnează un răspuns 401 Unauthorized. Dacă ID-ul produsului nu este valid, se returnează un răspuns 400 Bad Request. Dacă totul este în regulă, produsul este adăugat în coșul de cumpărături stocat în sesiune și se returnează un răspuns JSON cu un mesaj de succes și numărul de produse din coș.
app.post('/adaugare_cos', (req, res) => {
  if (!req.session.utilizator) { 
    return res.status(401).json({
      succes: false,
      mesaj: 'Trebuie să fii autentificat.'
    });
  }

  // Validăm ID-ul produsului pentru a preveni adăugarea unor valori invalide în coșul de cumpărături, ceea ce ar putea duce la erori sau vulnerabilități în aplicație.
  const idProdus = req.body.id;

  if (!esteIdValid(idProdus)) {
  return res.status(400).json({
    succes: false,
    mesaj: 'produs invalid.'
  });
}

  if (!req.session.cos) {
    req.session.cos = [];
  }

  req.session.cos.push(Number(idProdus));

  console.log('Coșul utilizatorului:', req.session.cos);

  res.json({
    succes: true,
    mesaj: 'Produsul a fost adăugat în coș.',
    numarProduseCos: req.session.cos.length
  });
});

// Ruta pentru vizualizarea coșului de cumpărături, care verifică dacă utilizatorul este autentificat și dacă există produse în coș. Dacă utilizatorul nu este autentificat, se redirecționează către pagina de autentificare. Dacă coșul este gol, se afișează o pagină cu un mesaj corespunzător. Dacă există produse în coș, se citesc detaliile produselor din baza de date și se calculează subtotalurile și totalul, apoi se afișează în vizualizarea "vizualizare-cos.ejs".
app.get('/vizualizare-cos', (req, res) => {
  if (!req.session.utilizator) {
    return res.redirect('/autentificare');
  }

  const cos = (req.session.cos || []).filter((id) => esteIdValid(id));

  if (cos.length === 0) {
    return res.render('vizualizare-cos', {
      produseCos: [],
      total: 0
    });
  }

  const db = new sqlite3.Database('cumparaturi.db', (err) => {
    if (err) {
      console.error('Eroare la conectarea la baza de date:', err.message);
      return res.redirect('/');
    }
  });

  const numarProduse = {}; // Obiect pentru a număra câte produse de fiecare tip există în coș, folosind ID-ul produsului ca cheie și cantitatea ca valoare.

  cos.forEach((id) => {
    if (!numarProduse[id]) {
      numarProduse[id] = 0;
    }

    numarProduse[id]++;
  });

  const iduriUnice = Object.keys(numarProduse); // Obținem o listă de ID-uri unice ale produselor din coș pentru a putea interoga baza de date și a obține detaliile fiecărui produs doar o singură dată, chiar dacă există mai multe unități din același produs în coș.
  const semneIntrebare = iduriUnice.map(() => '?').join(',');

  const sql = `SELECT * FROM produse WHERE id IN (${semneIntrebare})`;

  // Interogăm baza de date pentru a obține detaliile produselor din coș folosind ID-urile unice și apoi calculăm subtotalurile și totalul pentru a afișa în vizualizarea "vizualizare-cos.ejs". Dacă există o eroare la citirea produselor, se afișează un mesaj de eroare în consolă și se redirecționează utilizatorul către pagina principală.
  db.all(sql, iduriUnice, (err, produse) => {
    if (err) {
      console.error('Eroare la citirea produselor din coș:', err.message);
      db.close();
      return res.redirect('/');
    }

    // Calculăm subtotalurile pentru fiecare produs din coș și totalul general, apoi le afișăm în vizualizarea "vizualizare-cos.ejs". Subtotalul pentru fiecare produs se calculează înmulțind prețul produsului cu cantitatea din coș, iar totalul general se calculează adunând toate subtotalurile.
    const produseCos = produse.map((produs) => {
      const cantitateCos = numarProduse[produs.id];
      const subtotal = produs.pret * cantitateCos;

      // Returnăm un obiect care conține detaliile produsului, cantitatea din coș și subtotalul pentru a putea afișa aceste informații în vizualizarea "vizualizare-cos.ejs".
      return {
        ...produs,
        cantitateCos: cantitateCos,
        subtotal: subtotal
      };
    });

    const total = produseCos.reduce((suma, produs) => {
      return suma + produs.subtotal;
    }, 0);

    db.close((err) => {
      if (err) {
        console.error('Eroare la închiderea bazei de date:', err.message);
      }

      res.render('vizualizare-cos', {
        produseCos: produseCos,
        total: total
      });
    });
  });
});

// Rute pentru pagina de admin, care sunt protejate cu middleware-ul esteAdmin pentru a permite accesul doar utilizatorilor cu rolul de admin. Pagina de admin include un formular pentru adăugarea unui produs nou în baza de date, care este protejat cu middleware-ul csrfProtection pentru a preveni atacurile CSRF. La trimiterea formularului, se validează datele de intrare și se adaugă produsul în baza de date dacă totul este în regulă, apoi se redirecționează către pagina principală.
app.get('/admin', esteAdmin, csrfProtection, (req, res) => {
  res.render('admin', {
    csrfToken: req.csrfToken()
  });
});

// Ruta pentru adăugarea unui produs nou în baza de date, care este protejată cu middleware-ul esteAdmin pentru a permite accesul doar utilizatorilor cu rolul de admin și cu middleware-ul csrfProtection pentru a preveni atacurile CSRF. La trimiterea formularului, se validează datele de intrare (numele produsului și prețul) și se adaugă produsul în baza de date dacă totul este în regulă. Dacă există o eroare la adăugarea produsului, se afișează un mesaj de eroare corespunzător. După adăugarea cu succes a produsului, se redirecționează către pagina principală.
app.post('/admin/adauga-produs', esteAdmin, csrfProtection, (req, res) => {
  const nume = curataText(req.body.nume || '');
  const pret = Number(req.body.pret);

  if (!nume || Number.isNaN(pret) || pret < 0) {
    return res.status(400).send('Date produs invalide.');
  }

  const db = new sqlite3.Database('cumparaturi.db', (err) => {
    if (err) {
      console.error('Eroare la conectarea la baza de date:', err.message);
      return res.status(500).send('Eroare la baza de date.');
    }
  });

  // Adăugăm produsul în baza de date folosind o interogare parametrizată pentru a preveni atacurile de tip SQL Injection. Dacă există o eroare la adăugarea produsului, se afișează un mesaj de eroare corespunzător. Dacă produsul este adăugat cu succes, se redirecționează către pagina principală.
  db.run(
  'INSERT INTO produse (nume, pret) VALUES (?, ?)',
  [nume, pret],
    function (err) {
      if (err) {
        db.close();

        if (err.message.includes('UNIQUE constraint failed')) { // Verificăm dacă eroarea este cauzată de o încălcare a constrângerii UNIQUE, ceea ce înseamnă că un produs cu același nume există deja în baza de date. Dacă da, afișăm un mesaj de eroare specific pentru această situație.
          return res.status(400).send('Produsul există deja în baza de date.');
        }

        console.error('Eroare la adăugarea produsului:', err.message);
        return res.status(500).send('Eroare la adăugarea produsului.');
      }

      db.close(() => {
        res.redirect('/');
      });
    }
  );
});

// Rute pentru autentificare și delogare, care gestionează procesul de autentificare a utilizatorilor, inclusiv verificarea credențialelor, gestionarea blocărilor temporare în cazul încercărilor eșuate și afișarea mesajelor de eroare corespunzătoare. De asemenea, se asigură că utilizatorii autentificați pot accesa resursele protejate și că sesiunea este gestionată corespunzător.
app.get('/autentificare', (req, res) => {
  const mesajEroare = req.cookies.mesajEroare;

  res.clearCookie('mesajEroare');

  res.render('autentificare', {
    mesajEroare: mesajEroare,
    utilizatorAutentificat: req.session.utilizator
  });
});

// Ruta pentru verificarea autentificării, care primește datele de autentificare (utilizator și parolă) dintr-un formular, curăță și validează aceste date, și apoi verifică dacă există un cont cu aceste credențiale în baza de date. Dacă autentificarea reușește, se creează o sesiune pentru utilizator și se redirecționează către pagina principală. Dacă autentificarea eșuează, se gestionează blocările temporare în cazul încercărilor eșuate și se afișează mesajele de eroare corespunzătoare.
app.post('/verificare-autentificare', (req, res) => {
  const utilizatorIntrodus = curataEmail(req.body.utilizator) || String(req.body.utilizator || '').trim();
  const parolaIntrodusa = typeof req.body.parola === 'string' ? req.body.parola : '';
  const cheieLogin = req.ip;

  const dbBlacklist = new sqlite3.Database('blacklist.db');

  // Verificăm dacă există o blocare temporară pentru adresa IP a utilizatorului care încearcă să se autentifice. Dacă există o blocare activă, se afișează un mesaj de eroare și se oprește procesul de autentificare. Dacă nu există o blocare activă, se continuă cu verificarea credențialelor utilizatorului.
  dbBlacklist.get(
    'SELECT * FROM login_attempts WHERE email = ?',
    [cheieLogin],
    (err, row) => {
      const acum = Date.now();

      if (row && row.blocatPanaLa > acum) {
        dbBlacklist.close();

        return res.status(429).send(
          `Prea multe încercări. Încearcă din nou peste ${Math.ceil((row.blocatPanaLa - acum) / 60000)} minute.`
        );
      }

      // Funcție pentru a finaliza procesul de autentificare eșuat, care actualizează numărul de încercări eșuate și nivelul de blocare în baza de date, și apoi afișează un mesaj de eroare corespunzător. Dacă numărul de încercări eșuate depășește un anumit prag, se aplică o blocare temporară a contului și se afișează un mesaj de eroare specific pentru această situație.
      const finalizeazaLoginGresit = () => {
        let incercari = 1;
        let nivelBlocare = 0;
        let blocatPanaLa = 0;

        if (row) { // Dacă există deja o înregistrare pentru această adresă IP în tabela "login_attempts", actualizăm numărul de încercări eșuate și nivelul de blocare. Dacă timpul de blocare a expirat, resetăm numărul de încercări și nivelul de blocare.
          incercari = row.incercari + 1;
          nivelBlocare = row.nivelBlocare || 0;
        }

        if (incercari >= 3) {
          nivelBlocare++;

          const minuteBlocare = Math.min(nivelBlocare, 4);

          blocatPanaLa = Date.now() + minuteBlocare * 60 * 1000;
          incercari = 0;

          dbBlacklist.run( // Actualizăm tabela "login_attempts" cu numărul de încercări eșuate, nivelul de blocare și timpul până la care contul este blocat. Dacă numărul de încercări eșuate depășește pragul stabilit, se aplică o blocare temporară a contului și se afișează un mesaj de eroare specific pentru această situație.
            `
            INSERT INTO login_attempts (email, incercari, nivelBlocare, blocatPanaLa)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email)
            DO UPDATE SET
              incercari = ?,
              nivelBlocare = ?,
              blocatPanaLa = ?
            `,
            [
              cheieLogin,
              incercari,
              nivelBlocare,
              blocatPanaLa,
              incercari,
              nivelBlocare,
              blocatPanaLa
            ],
            () => {
              dbBlacklist.close();

              res.cookie( // Setăm un cookie cu un mesaj de eroare specific pentru situația în care numărul de încercări eșuate depășește pragul stabilit și se aplică o blocare temporară a contului. Acest mesaj va fi afișat pe pagina de autentificare la următoarea încărcare.
                'mesajEroare',
                `Prea multe încercări. Cont blocat ${minuteBlocare} minute.`,
                {
                  httpOnly: true,
                  sameSite: 'lax'
                }
              );

              return res.redirect('/autentificare');
            }
          );

          return;
        }

        dbBlacklist.run( 
          `
          INSERT INTO login_attempts (email, incercari, nivelBlocare, blocatPanaLa)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(email)
          DO UPDATE SET
            incercari = ?,
            nivelBlocare = ?,
            blocatPanaLa = ?
          `,
          [
            cheieLogin,
            incercari,
            nivelBlocare,
            blocatPanaLa,
            incercari,
            nivelBlocare,
            blocatPanaLa
          ],
          () => {
            dbBlacklist.close();

            res.cookie('mesajEroare', 'Utilizator sau parolă greșite!', { // Setăm un cookie cu un mesaj de eroare generic pentru situația în care autentificarea eșuează din cauza unor credențiale incorecte. Acest mesaj va fi afișat pe pagina de autentificare la următoarea încărcare.
              httpOnly: true,
              sameSite: 'lax'
            });

            return res.redirect('/autentificare');
          }
        );
      };

      // Validăm formatul email-ului și lungimea parolei pentru a preveni încercările de autentificare cu date invalide, ceea ce ar putea duce la erori sau vulnerabilități în aplicație. Dacă datele de autentificare nu sunt valide, se finalizează procesul de autentificare eșuat și se afișează un mesaj de eroare corespunzător.
      if (!validator.isEmail(utilizatorIntrodus) || parolaIntrodusa.length < 1) {
        return finalizeazaLoginGresit();
      }

      // Citim utilizatorii din baza de date și verificăm dacă există un cont cu credențialele introduse. Dacă există, verificăm dacă parola introdusă corespunde cu hash-ul stocat în baza de date folosind bcrypt. Dacă autentificarea reușește, se șterg încercările eșuate pentru această adresă IP din tabela "login_attempts", se creează o sesiune pentru utilizator și se redirecționează către pagina principală. Dacă autentificarea eșuează, se finalizează procesul de autentificare eșuat și se afișează un mesaj de eroare corespunzător.
      citesteUtilizatori((utilizatori) => {
        const utilizatorGasit = utilizatori.find((u) => {
          return u.utilizator === utilizatorIntrodus;
        });

        // Verificăm dacă parola introdusă corespunde cu hash-ul stocat în baza de date folosind bcrypt. Dacă autentificarea reușește, se șterg încercările eșuate pentru această adresă IP din tabela "login_attempts", se creează o sesiune pentru utilizator și se redirecționează către pagina principală. Dacă autentificarea eșuează, se finalizează procesul de autentificare eșuat și se afișează un mesaj de eroare corespunzător.
        const parolaCorecta =
          utilizatorGasit &&
          utilizatorGasit.parolaHash &&
          bcrypt.compareSync(parolaIntrodusa, utilizatorGasit.parolaHash);

        if (parolaCorecta) { // Dacă autentificarea reușește, se șterg încercările eșuate pentru această adresă IP din tabela "login_attempts", se creează o sesiune pentru utilizator și se redirecționează către pagina principală. Dacă autentificarea eșuează, se finalizează procesul de autentificare eșuat și se afișează un mesaj de eroare corespunzător.
          dbBlacklist.run(
            'DELETE FROM login_attempts WHERE email = ?',
            [cheieLogin],
            () => {
              dbBlacklist.close();

              req.session.utilizator = { // Creăm o sesiune pentru utilizatorul autentificat, stocând informațiile relevante despre utilizator în obiectul de sesiune. Aceste informații pot fi folosite ulterior pentru a personaliza experiența utilizatorului și pentru a controla accesul la resursele protejate.
                utilizator: utilizatorGasit.utilizator,
                nume: curataText(utilizatorGasit.nume || ''),
                prenume: curataText(utilizatorGasit.prenume || ''),
                rol: utilizatorGasit.rol || 'USER'
              };

              res.cookie('utilizator', utilizatorGasit.utilizator, { // Setăm un cookie cu numele de utilizator pentru a putea afișa acest lucru în interfața utilizatorului și pentru a personaliza experiența acestuia. Acest cookie este setat cu opțiunea httpOnly pentru a preveni accesul la acesta din partea scripturilor de pe client și cu opțiunea sameSite pentru a preveni atacurile de tip CSRF.
                httpOnly: true,
                sameSite: 'lax'
              });

              return res.redirect('/');
            }
          );
        } else {
          return finalizeazaLoginGresit();
        }
      });
    }
  );
});

// Ruta pentru delogare, care șterge cookie-ul cu numele de utilizator și distruge sesiunea curentă, apoi redirecționează către pagina de autentificare.
app.post('/delogare', (req, res) => {
  res.clearCookie('utilizator');

  req.session.destroy(() => {
    res.redirect('/autentificare');
  });
});

// Rute pentru chestionar, care afișează întrebările dintr-un fișier JSON în vizualizarea "chestionar.ejs" și apoi procesează răspunsurile trimise de utilizator pentru a calcula numărul de răspunsuri corecte și a afișa rezultatul în vizualizarea "rezultat-chestionar.ejs".
app.get('/chestionar', (req, res) => {
  citesteIntrebari((intrebari) => {
    res.render('chestionar', { intrebari });
  });
});

// Ruta pentru procesarea răspunsurilor la chestionar, care citește întrebările din fișierul JSON și compară răspunsurile trimise de utilizator cu răspunsurile corecte pentru a calcula numărul de răspunsuri corecte. Rezultatul este apoi afișat în vizualizarea "rezultat-chestionar.ejs", împreună cu numărul total de întrebări.
app.post('/rezultat-chestionar', (req, res) => {
  citesteIntrebari((intrebari) => {
    let raspunsuriCorecte = 0;

    intrebari.forEach((intrebare, index) => {
      const raspunsIndex = req.body[`intrebare_${index}`];

      if (raspunsIndex !== undefined) {
        const variantaAleasa = intrebare.variante[raspunsIndex];

        if (variantaAleasa.corect === true) {
          raspunsuriCorecte++;
        }
      }
    });

    res.render('rezultat-chestionar', {
      raspunsuriCorecte,
      totalIntrebari: intrebari.length
    });
  });
});

// Middleware pentru gestionarea cererilor către pagini inexistente, care verifică adresa IP a solicitantului și numărul de încercări de accesare a paginilor inexistente. Dacă un IP accesează pagini inexistente de prea multe ori într-un interval scurt de timp, acesta este blocat temporar și se afișează un mesaj de eroare corespunzător. Informațiile despre încercările de accesare a paginilor inexistente și blocările temporare sunt stocate într-o bază de date SQLite pentru a putea fi gestionate eficient.
app.use((req, res) => {
  const ip = req.ip;
  const acum = Date.now();

  const db = new sqlite3.Database('blacklist.db');

  // Verificăm dacă adresa IP a solicitantului are o blocare temporară activă în tabela "blacklist". Dacă există o blocare activă, se afișează un mesaj de eroare și se oprește procesarea cererii. Dacă nu există o blocare activă, se continuă cu procesarea cererii și se actualizează numărul de încercări de accesare a paginilor inexistente pentru această adresă IP în baza de date.
  db.get(
    'SELECT * FROM blacklist WHERE ip = ?',
    [ip],
    (err, row) => {
      if (err) {
        db.close();
        return res.status(500).send('Eroare server.');
      }

      if (row && row.blocatPanaLa > acum) {
        db.close();

        return res.status(429).send(
          `IP blocat temporar. Încearcă din nou peste ${Math.ceil((row.blocatPanaLa - acum) / 60000)} minute.`
        );
      }

      let incercari404 = 1;
      let nivelBlocare = 0;
      let blocatPanaLa = 0;

      if (row) { // Dacă există deja o înregistrare pentru această adresă IP în tabela "blacklist", actualizăm numărul de încercări de accesare a paginilor inexistente. Dacă timpul de blocare a expirat, resetăm numărul de încercări și nivelul de blocare.
        incercari404 = row.incercari404 + 1;
        nivelBlocare = row.nivelBlocare || 0;

        if (acum - row.ultimaIncercare > 10 * 60 * 1000) { // Dacă timpul scurs de la ultima încercare este mai mare de 10 minute, resetăm numărul de încercări și nivelul de blocare pentru această adresă IP, deoarece considerăm că utilizatorul a avut suficient timp pentru a-și corecta comportamentul și nu dorim să aplicăm o penalizare excesivă pentru încercările anterioare.
          incercari404 = 1;
        }
      }

      if (incercari404 >= 3) { // Dacă numărul de încercări de accesare a paginilor inexistente depășește pragul stabilit (3 încercări), se aplică o blocare temporară a adresei IP și se afișează un mesaj de eroare specific pentru această situație. Nivelul de blocare crește cu fiecare set de încercări eșuate, iar timpul de blocare este calculat în funcție de nivelul de blocare, cu un maximum de 4 minute.
        nivelBlocare++;

        const minuteBlocare = Math.min(nivelBlocare, 4);

        blocatPanaLa = acum + minuteBlocare * 60 * 1000;
        incercari404 = 0;
      }

      db.run(
        `
        INSERT INTO blacklist
        (ip, incercari404, nivelBlocare, blocatPanaLa, ultimaIncercare)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(ip)
        DO UPDATE SET
          incercari404 = ?,
          nivelBlocare = ?,
          blocatPanaLa = ?,
          ultimaIncercare = ?
        `,
        [
          ip,
          incercari404,
          nivelBlocare,
          blocatPanaLa,
          acum,
          incercari404,
          nivelBlocare,
          blocatPanaLa,
          acum
        ],
        () => {
          db.close();

          if (blocatPanaLa > 0) {
            return res.status(429).send(
              `Prea multe pagini inexistente accesate. IP blocat ${Math.min(nivelBlocare, 4)} minute.`
            );
          }

          return res.status(404).send('Pagina nu există.');
        }
      );
    }
  );
});

initializeazaBazaUtilizatori(); // Inițializăm baza de date pentru utilizatori, care creează tabela "utilizatori" dacă nu există deja și apoi verifică dacă există deja utilizatori în tabelă. Dacă există utilizatori, închide conexiunea la baza de date și returnează. Dacă nu există utilizatori, citește un fișier JSON cu utilizatorii și îi inserează în baza de date, apoi închide conexiunea și afișează un mesaj de confirmare.
initializeazaBlacklist(); // Inițializăm baza de date pentru blacklist, care creează tabelele "blacklist" și "login_attempts" dacă nu există deja. Tabela "blacklist" este folosită pentru a stoca adresele IP care au accesat pagini inexistente de prea multe ori, iar tabela "login_attempts" este folosită pentru a stoca încercările de autentificare eșuate și blocările temporare ale conturilor.

app.listen(port, () => { // Pornim serverul pe portul specificat și afișăm un mesaj în consolă pentru a indica că serverul a fost pornit cu succes și pe ce adresă și port este disponibil.
  console.log(`Server pornit pe http://localhost:${port}`);
});