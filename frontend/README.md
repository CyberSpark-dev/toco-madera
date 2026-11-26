# Frontend de Toco Madera v2.0.0

Angular 22 standalone, Tailwind CSS 4 y Flowbite 4. Consulta el [README principal](../README.md) para iniciar Flask y MySQL, conocer las rutas y preparar la demostración Android.

```powershell
npm.cmd ci
npm.cmd start
npx.cmd ng test --watch=false
npx.cmd ng build --configuration production
```

El servidor de desarrollo usa `http://localhost:4200/`. Para probar el Service Worker y la instalación sirve la compilación de `dist/frontend/browser` con fallback a `index.html`.
