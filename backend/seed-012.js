// Seed para a migração 012 (executar a partir de backend/)
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5433';
process.env.DB_NAME = 'workout_tracker';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'wt_dev_np64musgt3cl';

const fs = require('fs');
const bcrypt = require('bcrypt');
const pool = require('./db/pool');

function genCode(name) {
  const first = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return first + '-' + rand;
}

async function run() {
  // Passo 1: correr o SQL da migração em autocommit (sem transaction)
  // porque ADD VALUE em enum exige commit antes de ser usada.
  const migrationSql = fs.readFileSync('./db/migrations/012_dono_external_clients.sql', 'utf8');
  // Separar por ; e correr cada statement individualmente
  const statements = migrationSql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log('Migration SQL applied (autocommit).');

  // Passo 2: dados — agora que o enum está committed
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Gerar invite codes para PTs e nutricionistas sem código
    const coaches = await client.query(
      "SELECT id, name FROM users WHERE role IN ('personal_trainer','nutritionist') AND invite_code IS NULL"
    );
    for (const c of coaches.rows) {
      let code, exists;
      do {
        code = genCode(c.name);
        const check = await client.query('SELECT 1 FROM users WHERE invite_code = $1', [code]);
        exists = check.rowCount > 0;
      } while (exists);
      await client.query('UPDATE users SET invite_code = $1 WHERE id = $2', [code, c.id]);
      console.log('  invite_code for ' + c.name + ' (' + c.id + '): ' + code);
    }

    // Actualizar Ruben para dono, sem gym_id
    await client.query(
      "UPDATE users SET role = 'dono', gym_id = NULL WHERE email = 'ruben.francisco.correia2003@gmail.com'"
    );
    console.log('Ruben updated to dono (gym_id = NULL).');

    // Criar Gaspar como gym_owner do gym 1
    const hash = await bcrypt.hash('gaspar123', 10);
    await client.query(
      "INSERT INTO users (gym_id, name, email, password_hash, role) VALUES (1, 'Gaspar', 'gaspar@gmail.com', $1, 'gym_owner') ON CONFLICT (email) DO UPDATE SET role = 'gym_owner', gym_id = 1, password_hash = $1",
      [hash]
    );
    console.log('Gaspar created/updated as gym_owner of gym 1.');

    await client.query('COMMIT');
    console.log('Done.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error in data step:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
