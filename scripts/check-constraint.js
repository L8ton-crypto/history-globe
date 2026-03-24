const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HRLp6F7oICcn@ep-rough-glade-ailx0054-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require');
sql`SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname = 'valid_category'`.then(r => console.log(r));
