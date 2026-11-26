import { mensajeNotificable } from '../../core/services/notificaciones';
import { mensajeError } from '../../core/utils/mensajes';
import { formatearDinero } from '../../core/utils/dinero';
/**

  ======================================================

 * TOCO MADERA - COMPONENTE DE COMPRAS

 * Archivo: admin/compras/compras.ts

 * ETAPA 3.17

  ======================================================

 *

 * Integra:

 * - Proveedores existentes.

 * - Materias primas existentes.

 * - Registro de compras.

 * - Detalles y total.

 * - Recepción de materiales.

 * - Cancelación de borradores.

 *

 * IMPORTANTE:

 * Registrar una compra NO aumenta inventario.

 * Solamente recibirla genera movimientos.

  ======================================================

 */

import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { HttpErrorResponse, HttpClient } from '@angular/common/http';

import {

  AdminCompras,

  CompraAdmin,

  CompraFormulario,

  DetalleCompraFormulario,
  PreparacionCompra,
  PresentacionCompra,

} from '../../core/services/admin-compras';

import { AdminMateriales, MaterialAdmin, UnidadMedida } from '../../core/services/admin-materiales';

import { AdminProveedores, ProveedorAdmin } from '../../core/services/admin-proveedores';

import { Auth } from '../../core/services/auth';
import { formatearCantidad } from '../../core/utils/cantidades';

@Component({

  selector: 'app-compras-admin',

  standalone: true,

  imports: [FormsModule, RouterLink],

  templateUrl: './compras.html',

  styleUrl: './compras.css',

})

export class ComprasAdmin implements OnInit {
  readonly dinero = formatearDinero;

  // ====================================================

  // 1. SERVICIOS

  // ====================================================

  private readonly http = inject(HttpClient);

  // Costos base sugeridos y persistidos en materiales.costo_base.
  readonly costosBase = signal<Record<number, string>>({});
  readonly guardandoCostoBase = signal(false);

  private readonly costoBaseUrl = 'http://127.0.0.1:5000/api/v1/admin/costos-materiales/';

  private readonly comprasApi = inject(AdminCompras);

  private readonly materialesApi = inject(AdminMateriales);

  private readonly proveedoresApi = inject(AdminProveedores);

  private readonly auth = inject(Auth);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly ordenConsulta = signal<number | null>(null);
  readonly folioOrigen = signal('');
  readonly ordenFormulario = signal<number | null>(null);
  readonly preparacion = signal<PreparacionCompra | null>(null);
  readonly preparando = signal(false);
  readonly errorPreparacion = mensajeNotificable('error');
  readonly borrador = signal<CompraAdmin | null>(null);
  readonly abriendoBorrador = signal(false);
  readonly conflictoEdicion = signal(false);
  readonly ordenRecibida = signal<number | null>(null);
  private solicitudPreparacion = 0;
  private intentoAsistido?: { firma: string; clave: string };
  private readonly precargados = new Set<DetalleCompraFormulario>();

  // ====================================================

  // 2. REGISTROS

  // ====================================================

  readonly compras = signal<CompraAdmin[]>([]);

  readonly materiales = signal<MaterialAdmin[]>([]);
  private readonly unidades = signal<UnidadMedida[]>([]);

  readonly proveedores = signal<ProveedorAdmin[]>([]);

  // ====================================================

  // 3. ESTADO DE LA INTERFAZ

  // ====================================================

  readonly cargando = signal(true);

  readonly guardando = signal(false);

  readonly cargandoCatalogos = signal(true);

  readonly errorCatalogos = signal('');

  readonly mensaje = mensajeNotificable('exito');

  readonly error = mensajeNotificable('error');

  readonly mostrarFormulario = signal(false);

  readonly filtroEstado = signal('TODOS');

  readonly busqueda = signal('');

  // Acción pendiente de confirmación.

  readonly compraPendiente = signal<{

    compra: CompraAdmin;

    accion: 'RECIBIR' | 'CANCELAR';

  } | null>(null);

  // ====================================================

  // 4. FORMULARIO

  // ====================================================

  formulario: CompraFormulario = this.formularioVacio();

  private formularioVacio(): CompraFormulario {

    return {

      id_proveedor: 0,

      referencia_documento: '',

      observaciones: '',

      detalles: [

        {

          id_material: 0,

          cantidad: '1.0000',

          costo_unitario: '',

        },

      ],

    };

  }

  // ====================================================

  // 5. DATOS CALCULADOS

  // ====================================================

  readonly proveedoresActivos = computed(() => this.proveedores().filter((p) => Boolean(p.activo)));

  readonly materialesActivos = computed(() => this.materiales().filter((m) => Boolean(m.activo)));

  readonly comprasFiltradas = computed(() => {

    const texto = this.busqueda().trim().toLocaleLowerCase();

    const estado = this.filtroEstado();

    return this.compras().filter((compra) => {

      const proveedor = this.nombreProveedor(compra.id_proveedor);

      const coincideTexto =

        String(compra.id_compra).includes(texto) ||

        proveedor.toLocaleLowerCase().includes(texto) ||

        (compra.referencia_documento ?? '').toLocaleLowerCase().includes(texto);

      const coincideEstado = estado === 'TODOS' || compra.estado === estado;

      return coincideTexto && coincideEstado;

    });

  });

  // ====================================================

  // 6. INICIALIZAR

  // ====================================================

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const orden = Number(params.get('orden'));
      this.folioOrigen.set(params.get('folio') ?? '');
      if (Number.isSafeInteger(orden) && orden > 0) {
        if (this.ordenConsulta() !== orden) this.cargarPreparacion(orden, 0, true);
      } else {
        this.solicitudPreparacion++;
        this.ordenConsulta.set(null);
        this.preparacion.set(null);
        this.preparando.set(false);
        this.errorPreparacion.set('');
      }
    });

    this.cargarCompras();

    this.cargarCatalogos();

    this.cargarCostosBase();

  }

  // ====================================================

  // 7. CONSULTAR COMPRAS

  // ====================================================

  cargarCompras(): void {

    this.cargando.set(true);

    this.error.set('');

    this.comprasApi.listar().subscribe({

      next: (respuesta) => {

        this.compras.set(respuesta.compras);

        this.cargando.set(false);

      },

      error: (e: HttpErrorResponse) => {

        this.cargando.set(false);

        this.manejarError(e, 'No fue posible consultar las compras.');

      },

    });

  }

  // ====================================================

  // 8. CONSULTAR MATERIALES Y PROVEEDORES

  // ====================================================

  cargarCatalogos(): void {
    this.materialesApi.listarUnidades().subscribe({
      next: ({ unidades }) => this.unidades.set(unidades),
      error: () => this.unidades.set([]),
    });

    this.cargandoCatalogos.set(true);

    this.errorCatalogos.set('');

    let solicitudesPendientes = 2;

    let ocurrioError = false;

    const terminar = () => {

      solicitudesPendientes--;

      if (solicitudesPendientes === 0) {

        this.cargandoCatalogos.set(false);

        if (ocurrioError) {

          this.errorCatalogos.set(

            'No se pudieron cargar todos los catálogos. ' + 'Presiona Reintentar catálogos.',

          );

        }

      }

    };

    // Materiales

    this.materialesApi.listarMateriales().subscribe({

      next: (respuesta) => {

        this.materiales.set(respuesta.materiales);

        terminar();

      },

      error: (e: HttpErrorResponse) => {

        ocurrioError = true;

        this.materiales.set([]);

        this.manejarAutenticacion(e);

        terminar();

      },

    });

    // Proveedores

    this.proveedoresApi.listarProveedores().subscribe({

      next: (respuesta) => {

        this.proveedores.set(respuesta.proveedores);

        terminar();

      },

      error: (e: HttpErrorResponse) => {

        ocurrioError = true;

        this.proveedores.set([]);

        this.manejarAutenticacion(e);

        terminar();

      },

    });

  }

  // ====================================================

  // 9. CONSULTAR NOMBRES DE LOS CATÁLOGOS

  // ====================================================

  nombreProveedor(id: number): string {

    return this.proveedores().find((p) => p.id_proveedor === id)?.nombre ?? `Proveedor ${id}`;

  }

  unidadMaterial(id: number): string {
    const idUnidad = this.materiales().find((material) => material.id_material === id)?.id_unidad;
    if (idUnidad === undefined) return 'Unidad sin identificar';
    return this.unidades().find((unidad) => unidad.id_unidad === idUnidad)?.nombre ?? `Unidad #${idUnidad}`;
  }

  cantidadTexto(valor: string, unidad: string): ReturnType<typeof formatearCantidad> {
    const negativo = valor.startsWith('-');
    const magnitud = negativo ? valor.slice(1) : valor;
    const resultado = formatearCantidad(magnitud, unidad);
    if (/^\d+\.\d{3,}$/.test(resultado.texto)) {
      const visual = formatearCantidad(magnitud, '');
      return { texto: negativo ? '−(' + visual.texto + ')' : visual.texto,
        aviso: [resultado.aviso, visual.aviso].filter(Boolean).join(' ') };
    }
    if (!negativo) return resultado;
    return {
      texto: resultado.texto === '< 0.01' ? '> −0.01' : resultado.texto.replace(/\d/, '−$&'),
      aviso: resultado.aviso?.replace(magnitud, valor),
    };
  }

  nombreMaterial(id: number): string {

    return this.materiales().find((m) => m.id_material === id)?.nombre ?? `Material ${id}`;

  }

  // ====================================================

  // ====================================================
  // 9.1. CONSULTAR ÚLTIMO COSTO REAL DE COMPRA
  // ====================================================

  /**
   * Utiliza únicamente compras RECIBIDAS. El costo original
   * se conserva en cada detalle histórico y el administrador
   * puede cambiarlo si el proveedor cotiza un precio nuevo.
   *
   * No presenta $1.00 como un costo inventado.
   * Si no existe historial devuelve cadena vacía.
   */
  ultimoCostoMaterial(idMaterial: number): string {
    if (!idMaterial) {
      return '';
    }

    const base = this.costoBaseMaterial(idMaterial);
    if (base) return base;

    const recibidas = this.compras()
      .filter((compra) => compra.estado === 'RECIBIDA')
      .sort((a, b) => b.id_compra - a.id_compra);

    for (const compra of recibidas) {
      const detalle = compra.detalles.find(
        (item) => item.id_material === idMaterial,
      );

      if (detalle && Number(detalle.costo_unitario) > 0) {
        return String(detalle.costo_unitario);
      }
    }

    return this.costoBaseMaterial(idMaterial);
  }

  /**
   * Cada renglón tiene su propio objeto y su propio costo.
   * Al elegir un material, propone el último costo conocido.
   * El valor siempre puede editarse antes de guardar.
   */
  cambiarMaterial(detalle: DetalleCompraFormulario, idMaterial: number): void {
    this.quitarPresentacion(detalle);
    detalle.id_material = Number(idMaterial);
    detalle.costo_unitario = this.ultimoCostoMaterial(detalle.id_material);
  }

  tieneHistorialCosto(idMaterial: number): boolean {
    return this.ultimoCostoMaterial(idMaterial) !== '';
  }


  // ====================================================
  // 9.2 COSTOS BASE PERSISTENTES EN MYSQL
  // ====================================================
  cargarCostosBase(): void {
    this.http.get<{ success: boolean; costos: { id_material: number; costo_base: string | null }[] }>(
      this.costoBaseUrl
    ).subscribe({
      next: (respuesta) => {
        const costos: Record<number, string> = {};
        for (const item of respuesta.costos) {
          if (item.costo_base !== null && Number(item.costo_base) > 0) {
            costos[item.id_material] = item.costo_base;
          }
        }
        this.costosBase.set(costos);
        for (const detalle of this.formulario.detalles) {
          if (detalle.id_material && !detalle.costo_unitario.trim()) {
            detalle.costo_unitario = this.ultimoCostoMaterial(detalle.id_material);
          }
        }
      },
      error: (e: HttpErrorResponse) => {
        console.error('No se pudieron consultar los costos base:', e);
        this.errorCatalogos.set('No se pudo consultar la lista de costos base. Inténtalo nuevamente.');
      }
    });
  }

  costoBaseMaterial(idMaterial: number): string {
    return this.costosBase()[idMaterial] ?? '';
  }

  guardarCostoBase(detalle: DetalleCompraFormulario): void {
    const id = Number(detalle.id_material);
    const costo = detalle.costo_unitario.trim();
    if (!id || !/^\d{1,10}(\.\d{1,4})?$/.test(costo) || Number(costo) <= 0) {
      this.error.set('Selecciona un material y captura un costo positivo, máximo 4 decimales.');
      return;
    }
    if (!window.confirm('¿Actualizar el costo base sugerido de este material a ' + this.dinero(costo) + '? No se modificarán compras anteriores.')) {
      return;
    }
    this.guardandoCostoBase.set(true);
    this.error.set('');
    this.http.put<{success:boolean; costo_base:string}>(
      this.costoBaseUrl + id,
      {costo_base:costo}
    ).subscribe({
      next: (res) => {
        this.costosBase.update(actual => ({...actual, [id]: res.costo_base}));
        this.guardandoCostoBase.set(false);
        this.mensaje.set('Costo base actualizado correctamente. Los costos históricos de compra se conservan.');
      },
      error: (e: HttpErrorResponse) => {
        this.guardandoCostoBase.set(false);
        this.manejarError(e, 'No se pudo actualizar el costo base.');
      }
    });
  }

    // 10. CREAR FORMULARIO

  // ====================================================

  nuevaCompra(): void {

    this.mensaje.set('');

    this.error.set('');

    if (this.proveedoresActivos().length === 0 || this.materialesActivos().length === 0) {

      this.error.set(

        'Necesitas un proveedor activo y al menos ' +

          'un material activo para registrar una compra.',

      );

      return;

    }

    this.iniciarFormulario(null);
    this.formulario = this.formularioVacio();

    this.formulario.id_proveedor = this.proveedoresActivos()[0].id_proveedor;

    this.formulario.detalles[0].id_material = this.materialesActivos()[0].id_material;
    this.formulario.detalles[0].costo_unitario = this.ultimoCostoMaterial(
      this.formulario.detalles[0].id_material,
    );

    this.mostrarFormulario.set(true);

    setTimeout(() => {

      document.getElementById('formulario-compra')?.scrollIntoView({

        behavior: 'smooth',

        block: 'start',

      });

    }, 0);

  }

  cerrarFormulario(): void {

    if (!this.guardando()) {

      this.mostrarFormulario.set(false);

    }

  }

  cargarPreparacion(orden: number, proveedor = 0, precargar = false): void {
    const solicitud = ++this.solicitudPreparacion;
    if (this.ordenConsulta() !== orden) {
      this.preparacion.set(null);
      this.errorPreparacion.set('');
    }
    this.ordenConsulta.set(orden);
    this.preparando.set(true);
    this.comprasApi.preparar(orden, proveedor || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (datos) => {
          if (solicitud !== this.solicitudPreparacion) return;
          this.preparando.set(false);
          if (!datos.success || datos.id_orden !== orden) {
            this.mostrarErrorPreparacion('No pudimos comprobar los faltantes de la orden.');
            return;
          }
          this.preparacion.set(datos);
          this.errorPreparacion.set('');
          if (precargar && !this.mostrarFormulario()) this.abrirCompraAsistida(false);
        },
        error: (e: HttpErrorResponse) => {
          if (solicitud !== this.solicitudPreparacion) return;
          this.preparando.set(false);
          this.mostrarErrorPreparacion(this.mensajePreparacion(e));
        },
      });
  }

  private mostrarErrorPreparacion(texto: string): void {
    if (this.errorPreparacion() !== texto) this.errorPreparacion.set(texto);
  }

  private mensajePreparacion(error: HttpErrorResponse): string {
    switch (error.status) {
      case 0: return 'No pudimos conectar con el servicio de compras. Comprueba la conexión e inténtalo nuevamente.';
      case 401:
      case 422: return 'Tu sesión no es válida o ha vencido. Inicia sesión nuevamente.';
      case 403: return 'Tu cuenta no tiene permiso para preparar compras.';
      case 404: return 'La orden no se encontró. Vuelve a Producción y entregas y comprueba el folio.';
      case 503:
        if (error.error?.codigo === 'COMPRAS_ASISTIDAS_NO_HABILITADAS' ||
            error.error?.message === 'La compra asistida aún no está disponible.') {
          return 'La compra asistida todavía no está habilitada en este entorno. Puedes seguir registrando compras manuales.';
        }
        return 'El servicio de compras no está disponible en este momento. Inténtalo nuevamente.';
      default: return mensajeError(error, 'No pudimos comprobar los faltantes. Inténtalo nuevamente.');
    }
  }

  abrirCompraAsistida(enfocar = true): void {
    const datos = this.preparacion();
    if (!datos || this.guardando() || this.abriendoBorrador() || this.preparando() || this.errorPreparacion()) return;
    const faltantes = datos.materiales.filter((material) => Number(material.cantidad_sugerida) > 0);
    if (!faltantes.length) return;
    this.iniciarFormulario(datos.id_orden);
    this.formulario = {
      id_proveedor: 0, referencia_documento: null, observaciones: null,
      detalles: faltantes.map((material) => {
        const detalle = {
          id_material: material.id_material, cantidad: this.cantidadEditable(material.cantidad_sugerida),
          costo_unitario: this.ultimoCostoMaterial(material.id_material),
        };
        this.precargados.add(detalle);
        return detalle;
      }),
    };
    this.mostrarFormulario.set(true);
    if (enfocar) this.enfocarFormulario();
  }

  private enfocarFormulario(): void {
    setTimeout(() => document.getElementById('titulo-formulario-compra')?.focus(), 0);
  }

  haySugerencias(): boolean {
    return this.preparacion()?.materiales.some((material) => Number(material.cantidad_sugerida) > 0) ?? false;
  }

  motivoPreparacion(motivo: string | null): string {
    switch (motivo) {
      case 'RECETA_VACIA': return 'La orden no tiene materiales en su receta.';
      case 'MATERIAL_INACTIVO': return 'La orden requiere un material inactivo.';
      case 'ORDEN_YA_CONSUMIDA': return 'Los materiales de esta orden ya se consumieron.';
      case 'ORDEN_NO_ELEGIBLE': return 'La orden no está en un estado que permita preparar compras.';
      default: return 'No hay materiales faltantes para preparar una compra.';
    }
  }

  private iniciarFormulario(orden: number | null): void {
    this.precargados.clear();
    this.ordenFormulario.set(orden);
    this.borrador.set(null);
    this.conflictoEdicion.set(false);
    this.error.set('');
  }

  esPrecargado(detalle: DetalleCompraFormulario): boolean {
    return this.precargados.has(detalle);
  }

  private cantidadEditable(valor: string): string {
    return valor.includes('.') ? valor.replace(/0+$/, '').replace(/\.$/, '') : valor;
  }

  cambiarProveedor(proveedor: number): void {
    this.formulario.id_proveedor = proveedor;
    for (const detalle of this.formulario.detalles) {
      if (detalle.id_cotizacion !== undefined) {
        this.quitarPresentacion(detalle);
        detalle.costo_unitario = '';
      }
    }
    const orden = this.ordenFormulario();
    if (orden !== null) this.cargarPreparacion(orden, proveedor);
  }

  presentaciones(detalle: DetalleCompraFormulario): PresentacionCompra[] {
    if (this.ordenFormulario() !== this.preparacion()?.id_orden || this.preparando() ||
        this.errorPreparacion() || !this.formulario.id_proveedor) return [];
    return this.preparacion()?.materiales.find((m) => m.id_material === detalle.id_material)?.presentaciones ?? [];
  }

  elegirPresentacion(detalle: DetalleCompraFormulario, id: number | null): void {
    const oferta = this.presentaciones(detalle).find((p) => p.id_cotizacion === id);
    if (!oferta) {
      this.quitarPresentacion(detalle);
      return;
    }
    detalle.id_cotizacion = oferta.id_cotizacion;
    detalle.cantidad_presentaciones = oferta.cantidad_presentaciones_sugerida;
    detalle.presentacion_aplicada = oferta.presentacion;
    detalle.cantidad = this.cantidadEditable(oferta.cantidad_base_sugerida);
    detalle.costo_unitario = oferta.costo_unitario;
  }

  quitarPresentacion(detalle: DetalleCompraFormulario): void {
    delete detalle.id_cotizacion;
    delete detalle.cantidad_presentaciones;
    delete detalle.presentacion_aplicada;
  }

  abrirBorrador(id: number): void {
    if (this.guardando() || this.abriendoBorrador()) return;
    this.abriendoBorrador.set(true);
    this.error.set('');
    this.comprasApi.obtener(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.abriendoBorrador.set(false);
        if (!respuesta.success || respuesta.compra?.estado !== 'BORRADOR' || !respuesta.compra.revision) {
          this.error.set('Esta compra ya no está disponible para edición.');
          this.cargarCompras();
          return;
        }
        this.cargarBorrador(respuesta.compra);
        this.enfocarFormulario();
      },
      error: (e: HttpErrorResponse) => {
        this.abriendoBorrador.set(false);
        this.manejarError(e, 'No fue posible abrir el borrador.');
      },
    });
  }

  private cargarBorrador(compra: CompraAdmin): void {
    if (compra.id_orden_produccion && this.ordenConsulta() !== compra.id_orden_produccion) this.folioOrigen.set('');
    this.iniciarFormulario(compra.id_orden_produccion ?? null);
    this.borrador.set(compra);
    this.formulario = {
      id_proveedor: compra.id_proveedor,
      referencia_documento: compra.referencia_documento, observaciones: compra.observaciones,
      detalles: compra.detalles.map((detalle) => ({
        id_material: detalle.id_material, cantidad: this.cantidadEditable(detalle.cantidad), costo_unitario: detalle.costo_unitario,
        id_cotizacion: detalle.id_cotizacion ?? undefined,
        cantidad_presentaciones: detalle.cantidad_presentaciones ?? undefined,
        presentacion_aplicada: detalle.presentacion_aplicada ?? undefined,
      })),
    };
    this.mostrarFormulario.set(true);
    if (compra.id_orden_produccion) this.cargarPreparacion(compra.id_orden_produccion, compra.id_proveedor);
  }

  // ====================================================

  // 11. AGREGAR Y ELIMINAR RENGLONES

  // ====================================================

  agregarDetalle(): void {

    this.formulario.detalles.push({

      id_material: 0,

      cantidad: '1.0000',

      costo_unitario: '',

    });

  }

  quitarDetalle(indice: number): void {
    if (this.esPrecargado(this.formulario.detalles[indice])) return;

    if (this.formulario.detalles.length <= 1) {

      return;

    }

    this.formulario.detalles.splice(indice, 1);

  }

  // ====================================================

  // 12. CÁLCULOS DE IMPORTES

  // ====================================================

  subtotalDetalle(detalle: DetalleCompraFormulario): string {
    return this.importeEscalado(this.subtotalEscalado(detalle));
  }

  totalFormulario(): string {
    const total = this.formulario.detalles.reduce((suma, detalle) => suma + this.subtotalEscalado(detalle), 0n);
    return this.importeEscalado(total);
  }

  private subtotalEscalado(detalle: DetalleCompraFormulario): bigint {
    const escalaCuatro = (valor: string) => {
      const partes = /^(\d{1,10})(?:\.(\d{1,4}))?$/.exec(valor.trim());
      return partes ? BigInt(partes[1] + (partes[2] ?? '').padEnd(4, '0')) : 0n;
    };
    return escalaCuatro(detalle.cantidad) * escalaCuatro(detalle.costo_unitario);
  }

  private importeEscalado(importe: bigint): string {
    // El producto de dos DECIMAL de escala cuatro tiene escala ocho.
    const digitos = importe.toString().padStart(9, '0');
    return digitos.slice(0, -8) + '.' + digitos.slice(-8);
  }

  // ====================================================

  // 13. VALIDAR FORMULARIO

  // ====================================================

  decimalCompraValido(valor: string): boolean {
    return /^\d{1,10}(\.\d{1,4})?$/.test(valor.trim()) &&
      Number(valor) > 0 && Number(valor) <= 9999999999.9999;
  }

  private validarFormulario(): string | null {

    if (this.formulario.id_proveedor <= 0) {

      return 'Selecciona un proveedor.';

    }

    if (!this.proveedoresActivos().some((p) => p.id_proveedor === this.formulario.id_proveedor)) {

      return 'El proveedor seleccionado no está activo.';

    }

    if (this.formulario.detalles.length === 0) {

      return 'Agrega al menos un material.';

    }

    if ((this.formulario.referencia_documento ?? '').length > 90) {

      return 'La referencia admite máximo 90 caracteres.';

    }

    if ((this.formulario.observaciones ?? '').length > 300) {

      return 'Las observaciones admiten máximo 300 caracteres.';

    }

    const ids = new Set<number>();

    for (const detalle of this.formulario.detalles) {

      if (!this.materialesActivos().some((m) => m.id_material === detalle.id_material)) {

        return 'Selecciona un material activo válido.';

      }

      if (ids.has(detalle.id_material)) {

        return 'No repitas un mismo material en la compra.';

      }

      ids.add(detalle.id_material);

      if (!this.decimalCompraValido(detalle.cantidad)) {

        return 'La cantidad debe ser mayor que cero ' + 'y admitir máximo cuatro decimales.';

      }

      if (!this.decimalCompraValido(detalle.costo_unitario)) {

        return 'Ingresa el costo unitario real del material (mayor que cero, máximo cuatro decimales).';

      }

    }

    return null;

  }

  // ====================================================

  // 14. REGISTRAR COMPRA

  // ====================================================

  guardarCompra(): void {

    if (this.guardando() || this.abriendoBorrador() || this.conflictoEdicion()) {

      return;

    }

    this.error.set('');

    this.mensaje.set('');

    const errorValidacion = this.validarFormulario();

    if (errorValidacion) {

      this.error.set(errorValidacion);

      return;

    }

    this.guardando.set(true);

    // Enviar copia de los valores del formulario.

    const datos: CompraFormulario = {

      id_proveedor: Number(this.formulario.id_proveedor),

      referencia_documento: this.formulario.referencia_documento?.trim() || null,

      observaciones: this.formulario.observaciones?.trim() || null,

      detalles: this.formulario.detalles.map((d) => ({

        id_material: Number(d.id_material),

        cantidad: d.cantidad.trim(),

        costo_unitario: d.costo_unitario.trim(),
        ...(d.id_cotizacion === undefined ? {} : {
          id_cotizacion: d.id_cotizacion, cantidad_presentaciones: d.cantidad_presentaciones,
        }),

      })),

    };

    const borrador = this.borrador();
    const orden = this.ordenFormulario();
    if (!borrador && orden !== null) {
      datos.id_orden_produccion = orden;
      const firma = JSON.stringify(datos);
      if (this.intentoAsistido?.firma !== firma) {
        this.intentoAsistido = { firma, clave: globalThis.crypto.randomUUID() };
      }
      datos.clave_solicitud = this.intentoAsistido.clave;
    }
    const operacion = borrador?.revision
      ? this.comprasApi.editar(borrador.id_compra, { ...datos, revision: borrador.revision })
      : this.comprasApi.registrar(datos);

    operacion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({

      next: (respuesta) => {

        this.guardando.set(false);

        if (!respuesta.success || !respuesta.compra) {
          this.error.set('No se confirmó el guardado. Inténtalo nuevamente.');
          return;
        }
        this.intentoAsistido = undefined;
        const compra = respuesta.compra;
        const conservarEdicion = (borrador !== null || orden !== null) && compra.estado === 'BORRADOR' && !!compra.revision;
        if (conservarEdicion) this.cargarBorrador(compra);
        else this.mostrarFormulario.set(false);
        this.mensaje.set(respuesta.reutilizada
          ? `La compra #${compra.id_compra} ya estaba registrada.`
          : borrador ? `Borrador #${compra.id_compra} actualizado.`
          : `Compra #${compra.id_compra} registrada correctamente como borrador.`);

        this.cargarCompras();

        window.scrollTo({

          top: 0,

          behavior: 'smooth',

        });

      },

      error: (e: HttpErrorResponse) => {

        this.guardando.set(false);

        if (e.status === 409 && borrador) {
          this.conflictoEdicion.set(true);
          this.error.set('La compra cambió mientras la editabas. Tus cambios siguen en el formulario.');
          return;
        }
        if (e.status === 409 && orden !== null) {
          this.error.set('No pudimos guardar esta solicitud. Revisa los faltantes y los borradores de la orden.');
          this.cargarPreparacion(orden, this.formulario.id_proveedor);
          return;
        }
        this.manejarError(e, 'No fue posible guardar la compra.');

      },

    });

  }

  // ====================================================

  // 15. CONFIRMAR RECEPCIÓN O CANCELACIÓN

  // ====================================================

  solicitarAccion(compra: CompraAdmin, accion: 'RECIBIR' | 'CANCELAR'): void {

    if (compra.estado !== 'BORRADOR') {

      return;

    }

    this.compraPendiente.set({ compra, accion });

  }

  cancelarAccion(): void {

    if (!this.guardando()) {

      this.compraPendiente.set(null);

    }

  }

  confirmarAccion(): void {

    const pendiente = this.compraPendiente();

    if (!pendiente || this.guardando()) {

      return;

    }

    this.guardando.set(true);

    this.error.set('');

    this.mensaje.set('');

    const operacion =

      pendiente.accion === 'RECIBIR'

        ? this.comprasApi.recibir(pendiente.compra.id_compra)

        : this.comprasApi.cancelar(pendiente.compra.id_compra);

    operacion.subscribe({

      next: (respuesta) => {

        this.guardando.set(false);

        if (!respuesta.success) {
          this.error.set('No se confirmó la operación. Inténtalo nuevamente.');
          return;
        }
        this.compraPendiente.set(null);

        this.mensaje.set(pendiente.accion === 'RECIBIR'
          ? 'Compra recibida. Las existencias se actualizaron correctamente.'
          : 'Compra cancelada correctamente.');
        const idOrden = respuesta.compra?.id_orden_produccion ?? pendiente.compra.id_orden_produccion;
        this.ordenRecibida.set(pendiente.accion === 'RECIBIR' ? idOrden ?? null : null);
        if (this.borrador()?.id_compra === pendiente.compra.id_compra) this.cerrarFormulario();
        if (idOrden && this.ordenConsulta() === idOrden) this.cargarPreparacion(idOrden);

        this.cargarCompras();

      },

      error: (e: HttpErrorResponse) => {

        this.guardando.set(false);

        this.compraPendiente.set(null);

        this.manejarError(e, 'No fue posible completar la operación.');

      },

    });

  }

  // ====================================================

  // 16. AUTENTICACIÓN Y ERRORES

  // ====================================================

  private manejarAutenticacion(e: HttpErrorResponse): boolean {

    if (e.status === 401) {

      this.auth.cerrarSesion();

      this.router.navigateByUrl('/login');

      return true;

    }

    if (e.status === 403) {

      this.auth.cerrarSesion();

      this.router.navigateByUrl('/');

      return true;

    }

    return false;

  }

  private manejarError(e: HttpErrorResponse, predeterminado: string): void {

    console.error('Error en compras:', e);

    if (this.manejarAutenticacion(e)) {

      return;

    }

    this.error.set(mensajeError(e, predeterminado));

  }

  cerrarSesion(): void {

    this.auth.cerrarSesion();

    this.router.navigateByUrl('/login');

  }

}
