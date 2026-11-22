export type Route = "app" | "app-orcamento" | "app-clientes" | "app-catalogo" | "app-fornecedores" | "app-modelos" | "app-empresa";
export const go = (r: Route) => { window.location.hash = r; };
