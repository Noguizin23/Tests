import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Boxes, Building2, FileText, LayoutTemplate, Menu, Truck, Users, FilePen } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StoreProvider, companyOrDefault, useStore } from "@/data/store";
import { Sk } from "@/app/common";
import { cn } from "@/lib/utils";
import type { Route } from "@/app/route";
import Dashboard from "@/app/Dashboard";
import QuoteEditor from "@/app/QuoteEditor";
import Clients from "@/app/Clients";
import Catalog from "@/app/Catalog";
import Suppliers from "@/app/Suppliers";
import Templates from "@/app/Templates";
import CompanySettings from "@/app/CompanySettings";

const NAV: { r: Route; label: string; icon: typeof FileText }[] = [
  { r: "app", label: "Orçamentos", icon: FileText },
  { r: "app-orcamento", label: "Orçamento aberto", icon: FilePen },
  { r: "app-clientes", label: "Clientes", icon: Users },
  { r: "app-catalogo", label: "Catálogo", icon: Boxes },
  { r: "app-fornecedores", label: "Fornecedores", icon: Truck },
  { r: "app-modelos", label: "Modelos", icon: LayoutTemplate },
  { r: "app-empresa", label: "Empresa", icon: Building2 },
];

const routeOf = (h: string): Route | null => {
  const r = h.replace(/^#/, "");
  return (NAV.find((n) => n.r === r)?.r ?? (r.startsWith("app") ? "app" : null)) as Route | null;
};

function useRoute() {
  const [route, setRoute] = useState<Route | null>(() => routeOf(window.location.hash));
  useEffect(() => {
    const on = () => {
      const r = routeOf(window.location.hash);
      setRoute(r);
      document.documentElement.classList.toggle("modo-app", !!r);
      if (r) window.scrollTo({ top: 0 });
    };
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

function Nav({ route, onPick }: { route: Route; onPick?: () => void }) {
  const st = useStore();
  const open = st.quotes.find((q) => q.id === st.openQuoteId);
  const co = companyOrDefault(st.company);
  return (
    <div className="flex h-full flex-col gap-6 p-5 text-sidebar-foreground">
      <a href="#inicio" onClick={onPick} className="flex items-center gap-3">
        {co.logo ? <img src={co.logo} alt={co.brand} className="h-6 w-auto invert" /> : null}
      </a>
      <div>
        <p className="font-heading text-lg font-extrabold leading-tight">{co.brand}</p>
        <p className="text-xs text-white/55">Orçamentos de comunicação visual</p>
      </div>
      <nav className="grid gap-1" aria-label="Seções do app">
        {NAV.map(({ r, label, icon: I }) => (
          <a
            key={r}
            href={`#${r}`}
            onClick={onPick}
            aria-current={route === r ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-sidebar-accent hover:text-white",
              route === r && "bg-sidebar-accent text-white",
            )}
          >
            <span className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-magenta scale-y-0 transition-transform", route === r && "scale-y-100")} />
            <I className="size-4" />
            <span className="truncate">{label}</span>
            {r === "app-orcamento" && open ? <span className="ml-auto text-[11px] tabular text-white/50">{String(open.number).padStart(4, "0")}·r{open.revision}</span> : null}
          </a>
        ))}
      </nav>
      <div className="mt-auto grid gap-3 text-xs text-white/55">
        <span className={cn("inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 font-bold", st.mode === "compartilhado" ? "bg-[#1F8A5B]/20 text-[#7EE2B2]" : "bg-white/10")}>
          <i className={cn("size-2 rounded-full", st.mode === "compartilhado" ? "bg-[#7EE2B2]" : "bg-white/50")} />
          {st.mode === "compartilhado" ? "Dados compartilhados com a equipe" : st.mode === "local" ? "Dados salvos neste navegador" : "Conectando…"}
        </span>
        <a href="#inicio" onClick={onPick} className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft className="size-3.5" /> Voltar à página inicial</a>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando dados">
      <Sk className="h-10 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Sk key={i} className="h-24" />)}</div>
      <Sk className="h-80" />
    </div>
  );
}

function Seeder() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-3xl bg-card border p-8 grid gap-4 max-w-xl">
      <h1 className="text-3xl font-extrabold">Comece pelo catálogo inicial</h1>
      <p className="text-muted-foreground">O banco compartilhado ainda está vazio. Carregue os fornecedores pesquisados, as famílias de materiais e serviços, os modelos e o projeto demonstrativo. Você pode editar tudo depois.</p>
      <Button size="lg" disabled={busy} onClick={async () => { setBusy(true); try { await st.loadSeed(); } finally { setBusy(false); } }}>
        {busy ? "Carregando…" : "Carregar catálogo inicial"}
      </Button>
      {st.error ? <p className="text-sm text-destructive">{st.error}</p> : null}
    </div>
  );
}

function Shell({ route }: { route: Route }) {
  const st = useStore();
  const [menu, setMenu] = useState(false);
  let page: ReactNode;
  if (!st.ready) page = <Loading />;
  else if (st.mode === "compartilhado" && !st.company && st.suppliers.length === 0) page = <Seeder />;
  else
    page = {
      app: <Dashboard />,
      "app-orcamento": <QuoteEditor />,
      "app-clientes": <Clients />,
      "app-catalogo": <Catalog />,
      "app-fornecedores": <Suppliers />,
      "app-modelos": <Templates />,
      "app-empresa": <CompanySettings />,
    }[route];
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block sticky top-0 h-dvh bg-sidebar">
        <Nav route={route} />
      </aside>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-sidebar px-4 py-3 text-white" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <a href="#app" className="font-heading font-extrabold">{companyOrDefault(st.company).brand}</a>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => setMenu(true)} aria-label="Abrir menu"><Menu /></Button>
      </header>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-[280px] bg-sidebar border-sidebar-border p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Nav route={route} onPick={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <main key={route} className="min-w-0 px-4 py-6 md:px-8 md:py-8 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ paddingLeft: "max(16px, env(safe-area-inset-left))", paddingRight: "max(16px, env(safe-area-inset-right))" }}>
        {page}
      </main>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  return (
    <StoreProvider>
      {route ? <Shell route={route} /> : null}
      <Toaster position="top-center" richColors />
    </StoreProvider>
  );
}
