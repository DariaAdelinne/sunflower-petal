<div align="center">

# Sunflower Petal

### A full-stack flower-shop web application with authentication, shopping-cart functionality and role-based administration

A responsive web application built with Node.js, Express, EJS and SQLite. It combines a botanical product catalog with session management, secure form processing and an interactive plant-themed quiz.

<br>

<img src="screenshots/01-home-dashboard.png" alt="Sunflower Petal product dashboard" width="920">

<br>

![Node.js](https://img.shields.io/badge/Node.js-runtime-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-backend-000000?style=for-the-badge&logo=express&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-templates-B4CA65?style=for-the-badge)
![SQLite](https://img.shields.io/badge/SQLite-database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

</div>

---

## About the Project

**Sunflower Petal** is an educational full-stack web application designed for a small flower and plant shop. The project demonstrates how a server-rendered Express application can combine a product catalog, authentication, persistent storage and secure form handling in a single interface.

Visitors can browse the available products. Authenticated users can add items to a session-based shopping cart, review quantities and totals, and complete an interactive quiz about flowers and plants. Users with the `ADMIN` role receive access to a protected dashboard for catalog management.

The interface follows a responsive botanical theme and uses reusable EJS layouts to maintain a consistent design across the application.

---

## Main Features

### Product catalog and shopping cart

* SQLite-backed product catalog for flowers and plants
* Responsive product display
* Session-based shopping cart
* Quantity tracking, subtotals and calculated total

### Authentication and administration

* Session-based authentication
* Password hashing with `bcryptjs`
* Role-based access control
* Protected administrator dashboard
* Product creation through an admin-only form

### Interactive content

* Plant-themed multiple-choice quiz
* Questions loaded from JSON
* Score calculation and result summary
* Reusable EJS layouts and mobile-friendly styling

### Security-oriented backend features

* HTTP-only session cookies
* CSRF protection for the administrator product form
* Input normalization, escaping and validation
* Parameterized SQLite queries
* Temporary login throttling after repeated failed attempts
* Temporary IP blocking after repeated requests to non-existent routes

---

## Screenshots

### Product Dashboard

<div align="center">
  <img src="screenshots/01-home-dashboard.png" alt="Sunflower Petal product dashboard" width="820">
</div>

### Authentication

<div align="center">
  <img src="screenshots/02-authentication.png" alt="Sunflower Petal authentication page" width="820">
</div>

### Shopping Cart

<div align="center">
  <img src="screenshots/03-shopping-cart.png" alt="Sunflower Petal shopping cart" width="820">
</div>

### Plant Quiz

<div align="center">
  <img src="screenshots/04-plant-quiz.png" alt="Sunflower Petal interactive plant quiz" width="820">
</div>

### Administrator Panel

<div align="center">
  <img src="screenshots/05-admin-panel.png" alt="Sunflower Petal administrator panel" width="820">
</div>

---

## Technical Overview

| Area                  | Technologies and concepts                                      |
| --------------------- | -------------------------------------------------------------- |
| Runtime               | Node.js                                                        |
| Backend framework     | Express                                                        |
| View engine           | EJS and `express-ejs-layouts`                                  |
| Database              | SQLite                                                         |
| Authentication        | `express-session`, `bcryptjs` and `cookie-parser`              |
| Validation            | `validator`, normalization and escaping                        |
| Security              | CSRF protection, role checks and parameterized SQL queries     |
| Session behavior      | Shopping-cart state and authenticated-user state               |
| Styling               | HTML and CSS                                                   |
| Quiz data             | JSON                                                           |

---

## Project Structure

```text
sunflower-petal/
├── README.md
├── app.js
├── package.json
├── package-lock.json
├── intrebari.json
├── utilizatori.example.json
├── public/
│   └── style.css
├── scripts/
│   └── hash-parole.js
├── views/
│   ├── admin.ejs
│   ├── autentificare.ejs
│   ├── chestionar.ejs
│   ├── index.ejs
│   ├── layout.ejs
│   ├── rezultat-chestionar.ejs
│   └── vizualizare-cos.ejs
└── screenshots/
    ├── 01-home-dashboard.png
    ├── 02-authentication.png
    ├── 03-shopping-cart.png
    ├── 04-plant-quiz.png
    └── 05-admin-panel.png
```

---

## Run the Project Locally

### Requirements

* Node.js
* npm

### Install the dependencies

```bash
npm install
```

### Create a local user seed file

The real local user file is intentionally excluded from version control. Start from the safe example file:

```bash
cp utilizatori.example.json utilizatori.json
npm run hash-parole
```

### Start the server

```bash
node app.js
```

Open the application in your browser:

```text
http://localhost:6789
```

The SQLite databases are created and used locally. They are intentionally excluded from version control.

---

## Privacy and Security Note

This repository is intended as an educational and portfolio project, not as a production deployment.

Local user data and SQLite database files should remain excluded from version control. Before deploying the application publicly, the session secret should be moved to an environment variable, secure cookies should be enabled over HTTPS and the authentication and rate-limiting configuration should be reviewed.

---

## Future Improvements

* Move configuration values and the session secret to environment variables.
* Add product images and product categories.
* Persist shopping-cart items in the database.
* Add automated tests for routes and authorization rules.
* Create a dedicated error page with richer validation feedback.
* Use HTTPS and a production-grade session store for deployment.

---

## What I Learned

This project helped me practise:

* building a full-stack application with Node.js and Express;
* creating reusable server-rendered views with EJS;
* managing authentication and session-based application state;
* implementing role-based authorization;
* storing and retrieving data through SQLite;
* validating and protecting form submissions;
* applying security-oriented backend practices;
* preparing a web application for a public portfolio repository.

---

## Author

**Daria-Adelinne-Elena Cristea**
