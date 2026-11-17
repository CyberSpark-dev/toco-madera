import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-inicio",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./inicio.html",
  styleUrl: "./inicio.css",
})
export class Inicio {
  nombreEmpresa = "Toco Madera";

  eslogan = "Frases que vienen de raíz y se graban en el corazón.";

  productos: string[] = [
    "Portateléfonos",
    "Marcos fotográficos",
    "Rodillos de cocina",
    "Repisas",
    "Portallaves",
    "Placas de escritorio",
  ];
}
