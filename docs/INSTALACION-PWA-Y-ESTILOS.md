# Instalación PWA y grabado decorativo

## Prueba física en Android por USB

1. Compila desde `frontend` con `npx.cmd ng build --configuration production`. Sirve `dist/frontend/browser` en el puerto 4200 con fallback a `index.html`, como se indica en el [README](../README.md). En Chrome de escritorio, comprueba que el manifiesto cargue y que el Service Worker quede activo.
2. Con depuración USB activada, ejecuta `adb devices` y después `adb reverse tcp:4200 tcp:4200`. Si se requiere el catálogo real y Flask ya está corriendo en la computadora, ejecuta también `adb reverse tcp:5000 tcp:5000` para la URL de servicio actual. Esta etapa no requiere exponer puertos externamente.
3. Abre `http://localhost:4200/` en Chrome de Android. Espera a que arranque la versión de producción. Pulsa **Instalar Toco Madera**. Si Chrome no ofrece una solicitud directa, consulta las instrucciones que aparecen bajo el botón y prueba desde el menú de Chrome. Verifica el icono, el lanzamiento en modo independiente y el botón en el footer.
4. Desde la aplicación instalada, abre el catálogo y prueba navegación y recarga en una ruta de cliente. Las operaciones contra Flask siguen requiriendo conexión. Para evaluar Chrome desde la computadora puede utilizarse `chrome://inspect/#devices` con el teléfono conectado.
5. Al terminar, retira el reenvío con `adb reverse --remove tcp:4200` y `adb reverse --remove tcp:5000` si ambos estaban configurados. La verificación de instalación en Android físico queda pendiente.

## Grabado decorativo

El cliente puede personalizar el texto y ver el grabado con Great Vibes sobre las seis bases limpias. La zona del rodillo está centrada en el cuerpo cilíndrico. Checkout envía el texto validado y utiliza la columna original de grabado.

El archivo `database/migraciones-canceladas/20261126_01_estilo_grabado.sql` se conserva comentado como referencia del ensayo aislado anterior. Está cancelado y queda fuera del procedimiento de despliegue.
