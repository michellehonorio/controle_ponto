import { Injectable, effect, inject, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth, GoogleAuthProvider, User, getAuth,
  onAuthStateChanged, signInWithPopup, signOut,
} from 'firebase/auth';
import {
  Firestore, collection, doc, getDocs, getFirestore, writeBatch,
} from 'firebase/firestore';
import { PontoService } from '../ponto.service';
import { DiaResumo, Registro } from '../models';
import { FIREBASE_CONFIG } from '../constants';

const CHAVE_ULTIMA_SINCRONIZACAO = 'controle-ponto:ultima-sincronizacao';
const DEBOUNCE_MS = 4000;

interface DadosSincronizados {
  registros: Omit<Registro, 'id'>[];
  dias: DiaResumo[];
}

function chaveRegistro(r: Pick<Registro, 'data' | 'sequencia' | 'tipo'>): string {
  return `${r.data}_${r.sequencia}_${r.tipo}`;
}

const FIREBASE_CONFIGURADO = !!FIREBASE_CONFIG.apiKey;

/**
 * Sincroniza os dados locais (IndexedDB, via PontoService) com o Firestore da usuária
 * (spec item 7), num documento por registro/dia, isolado por conta Google (`uid`).
 */
@Injectable({ providedIn: 'root' })
export class SincronizacaoService {
  private readonly ponto = inject(PontoService);
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private uid: string | null = null;
  private ignorarProximaMudanca = false;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly conectado = signal(false);
  readonly contaEmail = signal<string | null>(null);
  readonly sincronizando = signal(false);
  readonly erroSincronizacao = signal<string | null>(null);
  readonly ultimaSincronizacaoEm = signal<number | null>(this.lerUltimaSincronizacaoSalva());

  constructor() {
    effect(() => {
      // dispara uma sincronização (com debounce) sempre que os dados locais mudarem,
      // mas só depois que a carga inicial do IndexedDB já terminou e há conta conectada.
      this.ponto.exportarTudo();
      if (!this.conectado() || !this.ponto.carregado()) return;
      if (this.ignorarProximaMudanca) {
        this.ignorarProximaMudanca = false;
        return;
      }
      if (this.debounceHandle) clearTimeout(this.debounceHandle);
      this.debounceHandle = setTimeout(() => this.sincronizar(), DEBOUNCE_MS);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.sincronizar());
    }
  }

  /** Chamado uma vez na inicialização do app (ver app.config.ts), antes de renderizar as rotas. */
  async inicializar(): Promise<void> {
    if (!FIREBASE_CONFIGURADO) return; // projeto Firebase ainda não configurado (ver docs/firebase-setup.md)
    const auth = this.obterAuth();
    onAuthStateChanged(auth, (usuario) => {
      if (usuario) {
        this.marcarConectado(usuario);
        this.sincronizar();
      } else {
        this.conectado.set(false);
        this.contaEmail.set(null);
        this.uid = null;
      }
    });
    setInterval(() => this.sincronizar(), 5 * 60 * 1000);
  }

  async conectar(): Promise<void> {
    if (!FIREBASE_CONFIGURADO) {
      this.erroSincronizacao.set('Projeto Firebase ainda não configurado (ver docs/firebase-setup.md).');
      return;
    }
    this.erroSincronizacao.set(null);
    try {
      // popup em vez de redirect: evita o bug conhecido de navegadores que bloqueiam o
      // armazenamento entre sites necessário pro Firebase recuperar o login após um redirect.
      await signInWithPopup(this.obterAuth(), new GoogleAuthProvider());
    } catch (e) {
      this.erroSincronizacao.set('Não foi possível conectar com o Google.');
      console.error(e);
    }
  }

  async desconectar(): Promise<void> {
    if (!this.auth) return;
    await signOut(this.auth);
  }

  async sincronizarAgora(): Promise<void> {
    await this.sincronizar();
  }

  private marcarConectado(usuario: User) {
    this.uid = usuario.uid;
    this.conectado.set(true);
    this.contaEmail.set(usuario.email ?? usuario.displayName ?? null);
  }

  private obterAuth(): Auth {
    if (!this.auth) {
      this.app = initializeApp(FIREBASE_CONFIG);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
    }
    return this.auth;
  }

  private obterDb(): Firestore {
    if (!this.db) throw new Error('Firestore ainda não inicializado.');
    return this.db;
  }

  private async obterDadosRemotos(): Promise<{ dados: DadosSincronizados; chavesRemotas: { registros: Set<string>; dias: Set<string> } }> {
    const uid = this.uid!;
    const db = this.obterDb();
    const [snapRegistros, snapDias] = await Promise.all([
      getDocs(collection(db, 'usuarios', uid, 'registros')),
      getDocs(collection(db, 'usuarios', uid, 'dias')),
    ]);
    const registros = snapRegistros.docs.map(d => d.data() as Omit<Registro, 'id'>);
    const dias = snapDias.docs.map(d => d.data() as DiaResumo);
    return {
      dados: { registros, dias },
      chavesRemotas: {
        registros: new Set(snapRegistros.docs.map(d => d.id)),
        dias: new Set(snapDias.docs.map(d => d.id)),
      },
    };
  }

  private async salvarDadosRemotos(
    mesclado: DadosSincronizados,
    chavesRemotas: { registros: Set<string>; dias: Set<string> },
  ): Promise<void> {
    const uid = this.uid!;
    const db = this.obterDb();
    const batch = writeBatch(db);

    const chavesMescladasRegistros = new Set(mesclado.registros.map(chaveRegistro));
    for (const r of mesclado.registros) {
      batch.set(doc(db, 'usuarios', uid, 'registros', chaveRegistro(r)), r);
    }
    for (const chave of chavesRemotas.registros) {
      if (!chavesMescladasRegistros.has(chave)) batch.delete(doc(db, 'usuarios', uid, 'registros', chave));
    }

    const chavesMescladasDias = new Set(mesclado.dias.map(d => d.data));
    for (const d of mesclado.dias) {
      batch.set(doc(db, 'usuarios', uid, 'dias', d.data), d);
    }
    for (const chave of chavesRemotas.dias) {
      if (!chavesMescladasDias.has(chave)) batch.delete(doc(db, 'usuarios', uid, 'dias', chave));
    }

    await batch.commit();
  }

  /**
   * Mescla local x remoto registro-a-registro (não a coleção inteira): pra cada chave
   * (data+sequência+tipo em registros, data em dias), fica o lado com `atualizadoEm` mais
   * recente. Um item que só existe do lado remoto e é mais antigo que a última sincronização
   * bem-sucedida deste dispositivo é tratado como excluído localmente (não volta).
   */
  private mesclar(local: DadosSincronizados, remoto: DadosSincronizados, ultimaSync: number): DadosSincronizados {
    const registros = this.mesclarLista(local.registros, remoto.registros, chaveRegistro, ultimaSync);
    const dias = this.mesclarLista(local.dias, remoto.dias, d => d.data, ultimaSync);
    return { registros, dias };
  }

  private mesclarLista<T extends { atualizadoEm: number }>(
    locais: T[], remotos: T[], chave: (item: T) => string, ultimaSync: number,
  ): T[] {
    const mapaLocal = new Map(locais.map(item => [chave(item), item]));
    const mapaRemoto = new Map(remotos.map(item => [chave(item), item]));
    const todasChaves = new Set([...mapaLocal.keys(), ...mapaRemoto.keys()]);

    const resultado: T[] = [];
    for (const k of todasChaves) {
      const doLocal = mapaLocal.get(k);
      const doRemoto = mapaRemoto.get(k);
      if (doLocal && doRemoto) {
        resultado.push((doLocal.atualizadoEm ?? 0) >= (doRemoto.atualizadoEm ?? 0) ? doLocal : doRemoto);
      } else if (doLocal && !doRemoto) {
        // só existe localmente: mantém (é novo, ou uma edição ainda não enviada)
        resultado.push(doLocal);
      } else if (doRemoto && !doLocal) {
        // só existe remotamente: adota, a menos que seja mais antigo que a última sincronização
        // deste dispositivo (nesse caso, foi excluído localmente de propósito depois de sincronizar).
        if (ultimaSync === 0 || (doRemoto.atualizadoEm ?? 0) > ultimaSync) resultado.push(doRemoto);
      }
    }
    return resultado;
  }

  private async sincronizar(): Promise<void> {
    if (!this.conectado() || this.sincronizando()) return;
    this.sincronizando.set(true);
    this.erroSincronizacao.set(null);
    try {
      const local = this.ponto.exportarTudo();
      const { dados: remoto, chavesRemotas } = await this.obterDadosRemotos();
      const ultimaSync = this.ultimaSincronizacaoEm() ?? 0;
      const mesclado = this.mesclar(local, remoto, ultimaSync);

      this.ignorarProximaMudanca = true;
      await this.ponto.importarTudo(mesclado);
      await this.salvarDadosRemotos(mesclado, chavesRemotas);

      const agora = Date.now();
      this.ultimaSincronizacaoEm.set(agora);
      localStorage.setItem(CHAVE_ULTIMA_SINCRONIZACAO, String(agora));
    } catch (e) {
      this.erroSincronizacao.set('Não foi possível sincronizar com o Firebase agora.');
      console.error(e);
    } finally {
      this.sincronizando.set(false);
    }
  }

  private lerUltimaSincronizacaoSalva(): number | null {
    try {
      const valor = localStorage.getItem(CHAVE_ULTIMA_SINCRONIZACAO);
      return valor ? Number(valor) : null;
    } catch {
      return null;
    }
  }
}
