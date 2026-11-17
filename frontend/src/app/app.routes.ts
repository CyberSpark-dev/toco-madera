import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    title: "Toco Madera | Inicio",
    loadComponent: () =>
      import("./cliente/inicio/inicio").then((m) => m.Inicio),
  },
  {
    path: "admin/dashboard",
    title: "Toco Madera | Dashboard",
    loadComponent: () =>
      import("./admin/dashboard/dashboard").then((m) => m.Dashboard),
  },
  {
    path: "**",
    redirectTo: "",
  },
];
