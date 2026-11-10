'use strict';
/* Storage adapters. Every collection holds documents with a string `id`.
   Interface: init, all(coll), get(coll,id), put(coll,doc), del(coll,id), rev(), close() */

const clone = x => JSON.parse(JSON.stringify(x));

class MemoryStore {
  constructor() { this.kind = 'memory'; this.c = new Map(); this._rev = 1; this._seq = 0; }
  _col(n) { if (!this.c.has(n)) this.c.set(n, new Map()); return this.c.get(n); }
  async init() {}
  async all(n) { return [...this._col(n).values()].sort((a, b) => a.seq - b.seq).map(r => clone(r.d)); }
  async get(n, id) { const r = this._col(n).get(id); return r ? clone(r.d) : null; }
  async put(n, doc) {
    const col = this._col(n), r = col.get(doc.id);
    col.set(doc.id, { seq: r ? r.seq : ++this._seq, d: clone(doc) });
    this._rev++;
  }
  async del(n, id) { if (this._col(n).delete(id)) this._rev++; }
  async rev() { return this._rev; }
  async close() {}
}

class MongoStore {
  constructor(uri, dbName) { this.kind = 'mongodb'; this.uri = uri; this.dbName = dbName; this._s = 0; }
  async init() {
    const { MongoClient } = require('mongodb');
    this.client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 20000 });
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    await this.db.command({ ping: 1 });
  }
  col(n) { return this.db.collection(n); }
  nextSeq() { this._s = Math.max(Date.now() * 1000, this._s + 1); return this._s; }
  async all(n) {
    const rows = await this.col(n).find({}).sort({ _seq: 1 }).toArray();
    return rows.map(r => r.d);
  }
  async get(n, id) {
    const r = await this.col(n).findOne({ _id: id });
    return r ? r.d : null;
  }
  async put(n, doc) {
    await this.col(n).updateOne({ _id: doc.id }, { $set: { d: doc }, $setOnInsert: { _seq: this.nextSeq() } }, { upsert: true });
    await this.bump();
  }
  async del(n, id) {
    const r = await this.col(n).deleteOne({ _id: id });
    if (r.deletedCount) await this.bump();
  }
  async bump() { await this.db.collection('meta').updateOne({ _id: 'rev' }, { $inc: { n: 1 } }, { upsert: true }); }
  async rev() { const r = await this.db.collection('meta').findOne({ _id: 'rev' }); return r ? r.n : 0; }
  async close() { await this.client.close(); }
}

function create(cfg) {
  return cfg.mongoUri ? new MongoStore(cfg.mongoUri, cfg.dbName) : new MemoryStore();
}

module.exports = { MemoryStore, MongoStore, create };
