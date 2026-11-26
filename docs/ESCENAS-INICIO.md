# Fotografías del carrusel de Inicio

| Escena | Recurso | Destino |
| --- | --- | --- |
| El trabajo detrás de cada pieza | `frontend/public/productos/inicio/taller-artesanal.webp` | Nosotros |
| Un regalo para recordar | `frontend/public/productos/inicio/familia-regalo-artesanal.webp` | Catálogo |
| Detalles que distinguen cada pieza | `frontend/public/productos/placa_escritorio.png` | Tarjeta de `TM-PE-01` si está disponible |
| Recuerdos hechos para quedarse | `frontend/public/productos/marco_fotografias.png` | Tarjeta de `TM-MF-01` si está disponible |

Las cuatro fotografías llenan el recuadro con `object-fit: cover` y un encuadre individual. Las escenas se configuran en el arreglo `escenas` de `frontend/src/app/cliente/inicio/inicio.ts`. Si la tarjeta de un SKU no está disponible, el enlace lleva al encabezado del catálogo.

El carrusel avanza cada seis segundos y reinicia la espera al usar las flechas. Se pausa mientras el cursor esté encima, durante la navegación por teclado y con la pestaña oculta. Con movimiento reducido conserva la navegación manual.

Para sustituir una imagen actualiza `foto`, `alt` y `posicion`. Comprueba el recorte a 360, 390, 768 y 1280 px.
