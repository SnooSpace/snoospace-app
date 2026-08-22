require('dotenv').config({path:'.env'});
const {Pool}=require('pg');
const p=new Pool({host:process.env.DB_HOST,port:parseInt(process.env.DB_PORT||'5432'),user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME,ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false});
(async()=>{
  const c=await p.connect();
  const r=await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='posts' ORDER BY ordinal_position");
  console.log('posts columns:', r.rows.map(x=>x.column_name).join(', '));
  const m=await c.query("SELECT id FROM members WHERE id NOT IN (SELECT DISTINCT follower_id FROM follows WHERE follower_type='member') AND id != 51 AND id != 52 LIMIT 3");
  console.log('no-follow members:', m.rows);
  c.release(); await p.end();
})().catch(e=>{console.error(e);process.exit(1)});
