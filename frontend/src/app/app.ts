import { Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { NotificacionesVista } from "./core/services/notificaciones-vista";
import { InstalacionPwa } from "./core/services/instalacion-pwa";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, NotificacionesVista],
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App {
  constructor() {
    inject(InstalacionPwa);
  }
}
