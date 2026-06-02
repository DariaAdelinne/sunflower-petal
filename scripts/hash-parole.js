const fs = require('fs');
const bcrypt = require('bcryptjs');

const fisier = 'utilizatori.json';
const utilizatori = JSON.parse(fs.readFileSync(fisier, 'utf8'));

const utilizatoriActualizati = utilizatori.map((u) => {
  if (!u.utilizator || !u.parola) {
    return u;
  }

  const utilizatorNou = {
    ...u,
    parolaHash: bcrypt.hashSync(u.parola, 12)
  };

  delete utilizatorNou.parola;

  return utilizatorNou;
});

fs.writeFileSync(fisier, JSON.stringify(utilizatoriActualizati, null, 2));
console.log('Parolele au fost transformate in hash-uri bcrypt.');