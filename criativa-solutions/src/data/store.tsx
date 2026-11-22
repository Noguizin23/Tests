import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { CatalogItem, Client, Company, Offer, Quote, Supplier, Template } from "@/domain/types";
import { seed } from "./seed";

export type Coll = "suppliers" | "items" | "offers" | "clients" | "quotes" | "templates";
export const COLLS: Coll[] = ["suppliers", "items", "offers", "clients", "quotes", "templates"];

export interface State {
  company: Company | null;
  suppliers: Supplier[];
  items: CatalogItem[];
  offers: Offer[];
  clients: Client[];
  quotes: Quote[];
  templates: Template[];
}
type Row = { id: string };

const EMPTY: State = { company: null, suppliers: [], items: [], offers: [], clients: [], quotes: [], templates: [] };
const LOCAL_KEY = "criativa-solutions-db-v1";
const clean = <T,>(x: T): T => JSON.parse(JSON.stringify(x)); // drops undefined for the document store

interface Backend {
  mode: "compartilhado" | "local";
  start(onState: (fn: (s: State) => State) => void, onReady: () => void): () => void;
  put(coll: Coll, row: Row): Promise<void>;
  del(coll: Coll, id: string): Promise<void>;
  putCompany(c: Company): Promise<void>;
}

/* Claude artifact db: one document per record, live for every viewer. */
type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[] };
type DocSnap = { exists?: boolean; data(): Record<string, unknown> | undefined };
interface ClaudeDb {
  collection(p: string): { onSnapshot(n: (s: Snap) => void, e?: (err: unknown) => void): () => void; doc(id: string): { set(d: object): Promise<void>; delete(): Promise<void> } };
  doc(p: string): { onSnapshot(n: (s: DocSnap) => void, e?: (err: unknown) => void): () => void; set(d: object): Promise<void> };
}

function sharedBackend(db: ClaudeDb): Backend {
  return {
    mode: "compartilhado",
    start(onState, onReady) {
      let pending = COLLS.length + 1;
      const done = () => --pending === 0 && onReady();
      const timer = setTimeout(onReady, 10000);
      const offs = COLLS.map((c) => {
        let first = true;
        return db.collection(c).onSnapshot(
          (snap) => {
            const rows = snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }));
            onState((s) => ({ ...s, [c]: rows }));
            if (first) { first = false; done(); }
          },
          () => { if (first) { first = false; done(); } },
        );
      });
      let firstC = true;
      offs.push(
        db.doc("config/company").onSnapshot(
          (d) => {
            const data = d.data();
            onState((s) => ({ ...s, company: data ? (data as unknown as Company) : null }));
            if (firstC) { firstC = false; done(); }
          },
          () => { if (firstC) { firstC = false; done(); } },
        ),
      );
      return () => { clearTimeout(timer); offs.forEach((o) => o()); };
    },
    put: (c, row) => db.collection(c).doc(row.id).set(clean(row)),
    del: (c, id) => db.collection(c).doc(id).delete(),
    putCompany: (c) => db.doc("config/company").set(clean(c)),
  };
}

/* Browser-only fallback (local dev, or a viewer without the shared store). */
function localBackend(): Backend {
  let cur: State = EMPTY;
  let push: ((fn: (s: State) => State) => void) | null = null;
  const save = async () => { try { await idbSet(LOCAL_KEY, cur); } catch { /* storage blocked: keep in memory */ } };
  const apply = (fn: (s: State) => State) => { cur = fn(cur); push?.(() => cur); return save(); };
  return {
    mode: "local",
    start(onState, onReady) {
      push = onState;
      (async () => {
        let stored: State | undefined;
        try { stored = await idbGet<State>(LOCAL_KEY); } catch { stored = undefined; }
        cur = stored ?? clean({ ...EMPTY, ...seed });
        if (!stored) await save();
        onState(() => cur);
        onReady();
      })();
      return () => { push = null; };
    },
    put: (c, row) => apply((s) => ({ ...s, [c]: upsert(s[c] as Row[], clean(row)) })),
    del: (c, id) => apply((s) => ({ ...s, [c]: (s[c] as Row[]).filter((r) => r.id !== id) })),
    putCompany: (co) => apply((s) => ({ ...s, company: clean(co) })),
  };
}

const upsert = <T extends Row>(list: T[], row: T) => {
  const i = list.findIndex((r) => r.id === row.id);
  return i < 0 ? [...list, row] : list.map((r, k) => (k === i ? row : r));
};

async function pickBackend(): Promise<Backend> {
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  if (claude?.use) {
    try {
      const db = (await claude.use("db")) as ClaudeDb | null;
      if (db) return sharedBackend(db);
    } catch { /* fall through */ }
  }
  return localBackend();
}

interface Store extends State {
  ready: boolean;
  mode: Backend["mode"] | null;
  error: string | null;
  put<C extends Coll>(coll: C, row: State[C][number]): Promise<void>;
  del(coll: Coll, id: string): Promise<void>;
  saveCompany(c: Company): Promise<void>;
  loadSeed(): Promise<void>;
  openQuoteId: string | null;
  setOpenQuoteId(id: string | null): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backend = useRef<Backend | null>(null);
  const [mode, setMode] = useState<Backend["mode"] | null>(null);
  const [openQuoteId, setOpen] = useState<string | null>(() => {
    try { return localStorage.getItem("criativa-open-quote"); } catch { return null; }
  });

  useEffect(() => {
    let stop = () => {};
    let alive = true;
    pickBackend().then((b) => {
      if (!alive) return;
      backend.current = b;
      setMode(b.mode);
      stop = b.start((fn) => setState(fn), () => setReady(true));
    });
    return () => { alive = false; stop(); };
  }, []);

  const guard = useCallback(async (p: () => Promise<void>) => {
    try { setError(null); await p(); } catch (e) {
      const code = (e as { code?: string })?.code;
      const msg = code === "not_granted" ? "Você tem acesso só de leitura. Peça permissão de edição ao dono do app." : "Não foi possível salvar. Verifique a conexão e tente de novo.";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const store = useMemo<Store>(() => ({
    ...state,
    ready,
    mode,
    error,
    put: (coll, row) => guard(async () => {
      setState((s) => ({ ...s, [coll]: upsert(s[coll] as Row[], row as Row) }));
      await backend.current!.put(coll, row as Row);
    }),
    del: (coll, id) => guard(async () => {
      setState((s) => ({ ...s, [coll]: (s[coll] as Row[]).filter((r) => r.id !== id) }));
      await backend.current!.del(coll, id);
    }),
    saveCompany: (c) => guard(async () => { setState((s) => ({ ...s, company: c })); await backend.current!.putCompany(c); }),
    loadSeed: () => guard(async () => {
      const b = backend.current!;
      await b.putCompany(seed.company);
      for (const c of COLLS) for (const row of (seed as unknown as Record<Coll, Row[]>)[c] ?? []) await b.put(c, row);
    }),
    openQuoteId,
    setOpenQuoteId: (id) => {
      setOpen(id);
      try { if (id) localStorage.setItem("criativa-open-quote", id); else localStorage.removeItem("criativa-open-quote"); } catch { /* ignore */ }
    },
  }), [state, ready, mode, error, guard, openQuoteId]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider ausente");
  return s;
}

export const companyOrDefault = (c: Company | null): Company => c ?? seed.company;
