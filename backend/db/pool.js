const { Pool, types } = require("pg");
require("dotenv").config({ quiet: true });

// Por omissão o driver converte colunas DATE num objeto Date em JS, que ao
// ser serializado para JSON desloca de fuso horário (ex: 2026-09-02 vira
// "2026-09-01T23:00:00.000Z" em UTC+1). Como só precisamos da data, não de
// hora, devolvemos sempre a string "YYYY-MM-DD" tal como o Postgres a dá.
types.setTypeParser(types.builtins.DATE, (value) => value);

// Suporta DATABASE_URL (Supabase, Railway, etc.) ou variáveis individuais
// (dev local). SSL é ativado automaticamente quando há DATABASE_URL.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    };

const pool = new Pool(poolConfig);

module.exports = pool;
