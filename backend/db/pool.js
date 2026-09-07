const { Pool, types } = require("pg");
require("dotenv").config({ quiet: true });

// Por omissão o driver converte colunas DATE num objeto Date em JS, que ao
// ser serializado para JSON desloca de fuso horário (ex: 2026-09-02 vira
// "2026-09-01T23:00:00.000Z" em UTC+1). Como só precisamos da data, não de
// hora, devolvemos sempre a string "YYYY-MM-DD" tal como o Postgres a dá.
types.setTypeParser(types.builtins.DATE, (value) => value);

// Pool de ligações reutilizáveis ao Postgres. Os módulos de acesso a dados
// (controllers) importam este pool e chamam pool.query(sql, params) —
// nunca abrem ligação própria.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
