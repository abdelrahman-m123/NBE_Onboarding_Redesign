import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './db.js'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const schemaPath = path.join(currentDir, 'schema.sql')

async function migrate() {
  const sql = await fs.readFile(schemaPath, 'utf8')
  const client = await pool.connect()

  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log('Applied database schema to public schema in nbe_onboarding.')
  } catch (error) {
    await client.query('rollback')
    console.error('Database migration failed.')
    console.error(error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
