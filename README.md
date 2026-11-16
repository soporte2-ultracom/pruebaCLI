# TaskFlow

Aplicación responsive de gestión de tareas en español, construida con HTML, CSS y JavaScript vanilla. No requiere dependencias, compilación, fuentes ni recursos externos.

## Ejecutar

Abre `index.html` en un navegador moderno. También puedes servir la carpeta desde este directorio:

```sh
python3 -m http.server 8000
```

Después abre `localhost:8000` en el navegador. No necesitas instalar paquetes.

## Uso

Escribe un título y, opcionalmente, una descripción. Añade la tarea, marca su casilla para completarla o desmarcarla y utiliza Todas / Pendientes / Completadas para filtrar. El contador muestra las tareas pendientes de toda la lista.

El botón de eliminación ofrece **Deshacer** para la última tarea eliminada, hasta otra eliminación o hasta cerrar/recargar la página. Al crear una tarea se muestra el filtro Todas para que sea visible inmediatamente.

Las tareas se guardan después de cada cambio en `localStorage` bajo la clave `taskflow.tasks.v1`. Los datos son locales a cada navegador y origen; abrir el archivo directamente y servirlo por HTTP puede usar almacenamientos distintos. Si el almacenamiento no está disponible o contiene JSON corrupto, la aplicación sigue funcionando y muestra un aviso. Un cambio posterior intenta guardar el estado actual, reemplazando los datos corruptos. Los registros inválidos y los identificadores duplicados se descartan durante la carga.

Incluye etiquetas de formulario, controles nativos accesibles con teclado, foco visible, anuncios de cambios para lectores de pantalla y estados vacíos por filtro. El contenido introducido se renderiza como texto.

## Archivos

- `index.html`: estructura semántica y formulario.
- `styles.css`: presentación responsive, estados y foco.
- `app.js`: interacciones, filtros, validación y persistencia tolerante a fallos.
- `tests.cjs`: pruebas locales con el módulo de aserciones integrado en Node.js.
- `README.md`: documentación.

## Verificación local

```sh
node --check app.js
node tests.cjs
```

Las pruebas cubren normalización, filtros, persistencia, JSON corrupto y almacenamiento bloqueado. También verifican referencias locales y ausencia de recursos HTTP(S) en los atributos `src`/`href` del HTML. No sustituyen una revisión visual o pruebas con lectores de pantalla en un navegador real.

La aplicación no sincroniza pestañas o dispositivos; al modificar tareas en varias pestañas prevalece el último guardado.
