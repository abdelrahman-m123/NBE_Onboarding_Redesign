import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: 'server/.env', override: false })

if (!process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY) {
  process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY
}
