import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ quiet: true })

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DATABASE_URL ? undefined : process.env.PGHOST || 'localhost',
  port: process.env.DATABASE_URL ? undefined : Number(process.env.PGPORT || 5432),
  database: process.env.DATABASE_URL ? undefined : process.env.PGDATABASE || 'nbe_onboarding',
  user: process.env.DATABASE_URL ? undefined : process.env.PGUSER || 'postgres',
  password: process.env.DATABASE_URL ? undefined : process.env.PGPASSWORD || 'postgres',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
})

export async function query(text, params) {
  return pool.query(text, params)
}
