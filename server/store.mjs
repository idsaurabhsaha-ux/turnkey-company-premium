export function d1Store(db) {
  if(!db)return null;
  return {
    async allow(key,now,limit) {
      const row=await db.prepare('INSERT INTO lead_rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+7200000).first();
      // Remove expired counters opportunistically; receipts have a 30-day horizon.
      await db.batch([db.prepare('DELETE FROM lead_rate_limits WHERE expires_at < ?').bind(now),db.prepare('DELETE FROM lead_receipts WHERE created_at < ?').bind(now-30*86400000)]);
      return row.count<=limit;
    },
    get: key=>db.prepare('SELECT id, payload_hash AS payloadHash, status, created_at AS createdAt FROM lead_receipts WHERE key_hash = ?').bind(key).first(),
    async claim(row) { const r=await db.prepare('INSERT OR IGNORE INTO lead_receipts (id,key_hash,payload_hash,status,created_at) VALUES (?,?,?,?,?)').bind(row.id,row.keyHash,row.payloadHash,row.status,row.createdAt).run();return r.meta.changes===1; },
    finish: (key,status)=>db.prepare('UPDATE lead_receipts SET status=? WHERE key_hash=?').bind(status,key).run()
  };
}
