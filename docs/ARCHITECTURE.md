# Viaje espacial — arquitectura técnica

El portafolio es un recorrido *scrollytelling*: la página HTML se desplaza con normalidad y una cámara 3D viaja por seis objetos astronómicos, uno por sección.

| # | Sección | Objeto | Escena |
|---|---------|--------|--------|
| 0 | Hero | Estrella masiva | `scenes/HeroStar.tsx` |
| 1 | Sobre mí | Nebulosa | `scenes/NebulaScene.tsx` |
| 2 | Habilidades | Nebulosa esmeralda | `scenes/NebulaScene.tsx` |
| 3 | Proyectos | Nebulosa carmesí | `scenes/NebulaScene.tsx` |
| 4 | Trayectoria | Nebulosa zafiro | `scenes/NebulaScene.tsx` |
| 5 | Contacto | Luna | `scenes/Moon.tsx` |

Las cuatro nebulosas comparten composición y aproximación de cámara (`nebulaStation` en `scenes/layout.ts`); solo cambian la paleta (`NEBULAE`) y las semillas.

## 1. Punto de partida

- Astro 5 estático (`output: 'static'`) desplegado en Vercel; sin framework de UI.
- Perfil y proyectos se obtienen de `api.code-musa.com` **en build**; las imágenes remotas se optimizan con `astro:assets`.
- El fondo era un starfield 2D en canvas dentro de un Web Worker, con tema claro/oscuro.
- Las secciones eran tarjetas HTML con un modal para los proyectos.

Se conservó lo que ya funcionaba bien: datos en build, imágenes optimizadas, CSS inline y el endpoint de contacto. Se reemplazó la capa visual.

## 2. Principio rector: el HTML es el contenido, el 3D es la cámara

Todo el contenido es HTML semántico renderizado en build, así que es indexable, legible con lector de pantalla y navegable con teclado. El canvas WebGL es una capa fija con `aria-hidden` detrás del contenido. Por eso:

- sin JavaScript, sin WebGL o con el 3D desactivado, la página sigue completa;
- el 3D se puede degradar o apagar sin tocar el contenido;
- React solo existe dentro de la isla del canvas (`client:only="react"`). Las secciones son componentes Astro sin JS de hidratación.

## 3. Estructura

```
src/
├── animations/        scroll → cámara
│   ├── scroll-director.ts   Lenis + ScrollTrigger: mide secciones y calcula `u`
│   └── camera-path.ts       curvas Catmull-Rom de posición y objetivo
├── assets/
│   └── textures.ts          texturas procedurales (canvas), hash deterministas
├── components/
│   ├── canvas/              piezas R3F reutilizables
│   │   ├── CameraRig.tsx        damping, parallax, encuadre
│   │   ├── Starfield.tsx        estrellas + Vía Láctea + galaxias lejanas
│   │   ├── SpaceDust.tsx        polvo infinito + estelas de velocidad
│   │   ├── NebulaCloud.tsx      nubes volumétricas instanciadas + partículas
│   │   ├── StarCore.tsx         estrella (plasma, corona, partículas)
│   │   ├── LensFlare.tsx        lens flare anamórfico procedural
│   │   ├── Effects.tsx          postprocesado + lente gravitacional
│   │   └── PerformanceMonitor.tsx
│   ├── sections/            HTML de cada estación (Astro)
│   ├── ui/SpaceBackdrop.astro   capa fija: póster CSS + isla 3D
│   ├── Header.astro         navegación, selector de calidad, HUD
│   └── Footer.astro
├── data/                    contenido estático editable
│   ├── site.ts              secciones, frase, email, intereses
│   ├── skills.ts            habilidades (rejilla con medidores)
│   └── experience.ts        trayectoria (⚠ placeholders)
├── hooks/                   useQuality, useStationVisibility, useBillboard
├── lib/
│   ├── store.ts             estado compartido DOM ↔ WebGL (sin three.js)
│   ├── scene-refs.ts        vectores compartidos dentro del canvas
│   ├── quality.ts           detección de GPU y presupuestos por nivel
│   └── data.ts              fetch de la API en build
├── scenes/                  una escena por estación + layout del universo
└── shaders/                 GLSL (noise, star, particles, flare, moon…)
```

## 4. Del scroll a la cámara

### 4.1 Parámetro `u`

`scroll-director.ts` mide cada sección y calcula dos claves en píxeles de scroll:

- `a` es cuando la sección llega a la zona de lectura (su borde superior al 30 % del viewport);
- `b` es cuando empieza a irse (su borde inferior al 70 %).

Entre `a` y `b` la cámara está **estacionada** en el objeto (segmento par de `u`). Entre la `b` de una sección y la `a` de la siguiente **vuela** (segmento impar). El vuelo dura unos 0,4 viewports de scroll y coincide con el hueco entre dos secciones, así que el texto nunca se mueve mientras la cámara acelera.

### 4.2 Curvas

`camera-path.ts` usa dos puntos por estación (*arrive* y *depart*): 12 puntos y 11 segmentos, que corresponden uno a uno a `u`. `CatmullRomCurve3.getPoint` reparte `t` de forma uniforme por segmento, así que el segmento *k* es exactamente `t ∈ [k, k+1]/11`. Los vuelos usan una curva *smootherstep* para desacelerar al llegar a cada objeto. Mientras está estacionada, la cámara hace un *dolly* lento entre *arrive* y *depart*.

### 4.3 Suavizado en capas

1. **Lenis** da inercia a la rueda del ratón.
2. **CameraRig** amortigua `u` con `MathUtils.damp` (independiente del framerate).

### 4.4 Habilidades y proyectos

Se muestran completos a la vez dentro de su nebulosa: una rejilla por sección, sin pasos de scroll por elemento. Los medidores de habilidad se llenan juntos cuando la rejilla entra en pantalla (`[data-inview]` → `is-inview`). Cada proyecto es un botón que abre un `<dialog>` modal con el detalle; mientras está abierto, Lenis se detiene (`space:lock` / `space:unlock`).

### 4.5 Piloto automático

El botón **Iniciar viaje** del hero (`animations/autopilot.ts`) recorre la página sola. No mueve la cámara directamente: anima el scroll con un timeline de GSAP, así que cámara, revelados, navegación, HUD y barra de progreso responden igual que con scroll manual. Cada estación tiene tres tiempos: despegue o vuelo (~4,6 s), exploración a ritmo de lectura (105 px/s, entre 6 y 16 s) y salida. Durante el viaje aparecen barras de cine, un indicador de destino y el botón *Tomar el control* (`components/ui/Autopilot.astro`). Cualquier rueda, toque, tecla o clic devuelve el control. Si se inicia a mitad de página, continúa desde ahí; si se inicia al final, vuelve a empezar.

En vuelo, `CameraRig` inclina la cámara según la velocidad lateral (alabeo, como una nave en una curva) y abre el FOV hasta 7° con la velocidad.

### 4.6 Encuadre

Cada estación declara `frameX` y `frameY`: dónde debe quedar el objeto en pantalla. El rig desplaza el punto de mira en unidades del frustum (`distancia × tan(fov/2) × aspecto`). Así el objeto deja sitio al texto en cualquier resolución: lateral en escritorio, mitad superior en móvil vertical.

## 5. Rendimiento

| Técnica | Dónde |
|---------|-------|
| Cero estado React por frame: todo se muta en `useFrame` desde `frame` y `sceneRefs` | `lib/store.ts` |
| Animación 100 % en GPU (uniform `uTime`) | `shaders/particles.ts` |
| Instancing: cada nube de nebulosa en 1 draw call | `NebulaCloud` |
| Polvo infinito con un único buffer que envuelve la cámara (`mod`) | `SpaceDust` |
| Estaciones lejanas ocultas (`visible = false`), lo que evita draw calls y fill-rate | `useStationVisibility` |
| Shaders precompilados con `compileAsync` al montar, sin tirones al llegar | `useStationVisibility` |
| Code splitting: hero en el primer chunk, el resto en `requestIdleCallback`, postprocesado aparte | `SpaceExperience.tsx` |
| Texturas procedurales: 0 descargas de imágenes para el universo | `assets/textures.ts` |
| Capturas de proyectos a WebP 960×540 en build | `pages/index.astro` |
| DPR limitado por nivel; tone mapping una sola vez en el composer | `lib/quality.ts`, `Effects.tsx` |
| Canvas a `100lvh`: la barra de URL móvil no redimensiona el canvas | `SpaceBackdrop.astro` |
| `backdrop-filter` solo en nivel alto (re-muestrea el canvas cada frame) | `global.css` |

### Niveles de calidad

`lib/quality.ts` detecta WebGL2, renderizadores por software (SwiftShader, llvmpipe), memoria, núcleos, puntero táctil y `saveData`. Un único presupuesto define todo:

| | high | medium | low | off |
|--|--|--|--|--|
| DPR máx. | 1.75 | 1.35 | 1 | – |
| Postprocesado | Bloom, DOF, CA, grano, viñeta, lente | igual, sin DOF | no (antialias nativo) | – |
| Estrellas | 9k | 5.5k | 2.8k | fondo CSS |

`PerformanceMonitor` mide FPS en ventanas de 2 s. Tras dos ventanas seguidas por debajo de 45 FPS baja un nivel en modo *auto* y avisa con un toast accesible. Nunca vuelve a subir, así que no puede oscilar. El usuario puede fijar el nivel en el selector del header (se guarda en `localStorage`).

## 6. Accesibilidad

- **`prefers-reduced-motion`**: arranca en modo sin 3D, sin Lenis y sin animaciones de entrada. Un script inline en `<head>` aplica el layout compacto antes del primer pintado, sin reflow. El usuario puede activar el 3D a mano.
- **Modo sin 3D**: la misma página con secciones compactas.
- **Navegación**: skip link, `<nav>` con `aria-current`, anclas que vuelan la cámara y luego **mueven el foco** al título de la sección, `:focus-visible` en todo.
- **Proyectos**: cada tarjeta es un `<button>` que abre un `<dialog>` modal; Esc, el botón de cerrar o un clic fuera lo cierran y el foco vuelve a la tarjeta.
- **Formulario**: etiquetas reales, `aria-invalid`, estado en `role="status"`.
- Medidores de habilidad con `role="meter"` y valores ARIA.

## 7. Efectos visuales

- **Bloom** (mipmap blur) sobre valores HDR (>1) que emiten los shaders de estrellas, luces de navegación de los satélites.
- **Depth of Field** con autofocus en el objeto mirado (`sceneRefs.focusPoint`); solo en nivel alto.
- **Niebla volumétrica**: sprites instanciados de fBm que se disuelven al entrar la cámara, más tres bancos de bruma entre estaciones.
- **Lens flare** anamórfico procedural.
- **Luna procedural**: cráteres en varias escalas (rejilla 3D con jitter), mares, sistemas de rayos, relieve por *bump* con derivadas de pantalla, iluminación Lommel–Seeliger + Lambert, luz cenicienta y luces de bases en el lado nocturno. La rodean un halo, satélites en órbitas inclinadas con estelas y luces de navegación, y un anillo de polvo. El número de octavas de cráteres baja con el nivel de calidad.
- **Estelas de velocidad**: el mismo polvo dibujado como líneas estiradas según la velocidad real de la cámara.

## 8. Contenido pendiente

- `src/data/experience.ts`: **todos los valores son placeholders `[entre corchetes]`**.
- `src/data/skills.ts`: niveles y descripciones son estimaciones editables.
- `src/data/site.ts`: `email` vacío (oculta el bloque) y la lista de intereses.

## 9. Mejoras propuestas

1. **KTX2/Basis** para cualquier textura futura (compresión en GPU; `KTX2Loader` con transcoder en worker).
2. **Nebulosas por impostor**: renderizar cada nebulosa lejana una vez a una textura y dibujarla como sprite hasta que la cámara se acerque.
3. **Audio espacial opcional** (Web Audio, apagado por defecto): drones ambientales por estación.
4. **God rays** de la estrella del hero con `GodRaysEffect` en nivel alto.
5. **Transición de "salto"** al pulsar un enlace del menú lejano: FOV que se abre y estelas más largas durante `lenis.scrollTo`.
6. **OffscreenCanvas + worker** para R3F (`@react-three/offscreen`) en navegadores compatibles, sacando el render del hilo principal como hacía el starfield anterior.
7. **Imagen OG** generada del hero 3D en build (Playwright) en lugar de `og-image.jpg` estática.
