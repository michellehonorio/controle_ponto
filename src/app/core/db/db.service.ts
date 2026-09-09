import { Injectable } from '@angular/core';
import { DiaResumo, Registro } from '../models';

const DB_NAME = 'controle-de-ponto';
const DB_VERSION = 1;
const STORE_REGISTROS = 'registros';
const STORE_DIAS = 'dias';

@Injectable({ providedIn: 'root' })
export class DbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private abrir(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_REGISTROS)) {
          const store = db.createObjectStore(STORE_REGISTROS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('porData', 'data', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DIAS)) {
          db.createObjectStore(STORE_DIAS, { keyPath: 'data' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  private async store(nome: string, modo: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.abrir();
    return db.transaction(nome, modo).objectStore(nome);
  }

  private wrap<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async listarRegistros(): Promise<Registro[]> {
    const store = await this.store(STORE_REGISTROS, 'readonly');
    return this.wrap(store.getAll());
  }

  async salvarRegistro(registro: Registro): Promise<number> {
    const store = await this.store(STORE_REGISTROS, 'readwrite');
    return this.wrap(store.put(registro)) as unknown as Promise<number>;
  }

  async excluirRegistro(id: number): Promise<void> {
    const store = await this.store(STORE_REGISTROS, 'readwrite');
    await this.wrap(store.delete(id));
  }

  async listarDias(): Promise<DiaResumo[]> {
    const store = await this.store(STORE_DIAS, 'readonly');
    return this.wrap(store.getAll());
  }

  async salvarDia(dia: DiaResumo): Promise<void> {
    const store = await this.store(STORE_DIAS, 'readwrite');
    await this.wrap(store.put(dia));
  }

  async obterDia(data: string): Promise<DiaResumo | undefined> {
    const store = await this.store(STORE_DIAS, 'readonly');
    return this.wrap(store.get(data));
  }
}
