# Viaje espacial — arquitectura técnica

El portafolio es un recorrido *scrollytelling*: la página HTML se desplaza con normalidad y una cámara 3D viaja por seis objetos astronómicos, uno por sección.

| # | Sección | Objeto | Escena |
|---|---------|--------|--------|
| 0 | Hero | Estrella masiva | `scenes/HeroStar.tsx` |
| 1 | Sobre mí | Nebulosa | `scenes/NebulaScene.tsx` |
| 2 | Habilidades | Sistema planetario | `scenes/SkillSystem.tsx` |
| 3 | Proyectos | Galaxia espiral | `scenes/ProjectGalaxy.tsx` |
| 4 | Trayectoria | Estación orbital | `scenes/SpaceStation.tsx` |
| 5 | Contacto | Agujero de gusano | `scenes/Wormhole.tsx` |

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
│   │   ├── CameraRig.tsx        damping, foco en planetas, parallax, encuadre
│   │   ├── Starfield.tsx        estrellas + Vía Láctea + galaxias lejanas
│   │   ├── SpaceDust.tsx        polvo infinito + estelas de velocidad
│   │   ├── NebulaCloud.tsx      nubes volumétricas instanciadas + partículas
│   │   ├── StarCore.tsx         estrella (plasma, corona, partículas)
│   │   ├── Planet.tsx           planeta procedural + atmósfera + anillos
│   │   ├── LensFlare.tsx        lens flare anamórfico procedural
│   │   ├── Hologram.tsx         proyección holográfica de capturas
│   │   ├── Effects.tsx          postprocesado + lente gravitacional
│   │   └── PerformanceMonitor.tsx
│   ├── sections/            HTML de cada estación (Astro)
│   ├── ui/SpaceBackdrop.astro   capa fija: póster CSS + isla 3D
│   ├── Header.astro         navegación, selector de calidad, HUD
│   └── Footer.astro
├── data/                    contenido estático editable
│   ├── site.ts              secciones, frase, email, intereses
│   ├── skills.ts            habilidades → planetas
│   └── experience.ts        trayectoria (⚠ placeholders)
├── hooks/                   useQuality, useStationVisibility, useBillboard
├── lib/
│   ├── store.ts             estado compartido DOM ↔ WebGL (sin three.js)
│   ├── scene-refs.ts        vectores compartidos dentro del canvas
│   ├── quality.ts           detección de GPU y presupuestos por nivel
│   └── data.ts              fetch de la API en build
├── scenes/                  una escena por estación + layout del universo
└── shaders/                 GLSL (noise, star, planet, particles, wormhole…)
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
3. El foco en planetas tiene su propio damping, así que pasar de un planeta a otro traza un arco.

### 4.4 Foco en planetas

Habilidades y proyectos son *steps*: un `<li>` de 100svh por elemento. ScrollTrigger marca activo el step que cruza el centro del viewport (rangos contiguos, sin huecos). La cámara se coloca **al lado del planeta a lo largo de su órbita**, no entre el sol y el planeta, así que el planeta siempre se ve en media fase con el terminador visible, y la cámara nunca atraviesa la estrella central.

### 4.5 Encuadre

Cada estación declara `frameX` y `frameY`: dónde debe quedar el objeto en pantalla. El rig desplaza el punto de mira en unidades del frustum (`distancia × tan(fov/2) × aspecto`). Así el objeto deja sitio al texto en cualquier resolución: lateral en escritorio, mitad superior en móvil vertical.

## 5. Rendimiento

| Técnica | Dónde |
|---------|-------|
| Cero estado React por frame: todo se muta en `useFrame` desde `frame` y `sceneRefs` | `lib/store.ts` |
| Animación 100 % en GPU (uniform `uTime`); 30k estrellas de galaxia sin coste JS | `shaders/particles.ts` |
| Instancing: nebulosas en 1 draw call; naves con `InstancedMesh` | `NebulaCloud`, `SpaceStation` |
| Polvo infinito con un único buffer que envuelve la cámara (`mod`) | `SpaceDust` |
| Estaciones lejanas ocultas (`visible = false`), lo que evita draw calls y fill-rate | `useStationVisibility` |
| Shaders precompilados con `compileAsync` al montar, sin tirones al llegar | `useStationVisibility` |
| Code splitting: hero en el primer chunk, el resto en `requestIdleCallback`, postprocesado aparte | `SpaceExperience.tsx` |
| Texturas procedurales: 0 descargas de imágenes para el universo | `assets/textures.ts` |
| Capturas de proyectos a WebP 960×540 en build; en 3D solo se descargan al enfocar el proyecto | `pages/index.astro`, `Hologram.tsx` |
| DPR limitado por nivel; tone mapping una sola vez en el composer | `lib/quality.ts`, `Effects.tsx` |
| Canvas a `100lvh`: la barra de URL móvil no redimensiona el canvas | `SpaceBackdrop.astro` |
| `backdrop-filter` solo en nivel alto (re-muestrea el canvas cada frame) | `global.css` |

### Niveles de calidad

`lib/quality.ts` detecta WebGL2, renderizadores por software (SwiftShader, llvmpipe), memoria, núcleos, puntero táctil y `saveData`. Un único presupuesto define todo:

| | high | medium | low | off |
|--|--|--|--|--|
| DPR máx. | 1.75 | 1.35 | 1 | – |
| Postprocesado | Bloom, DOF, CA, grano, viñeta, lente | igual, sin DOF | no (antialias nativo) | – |
| Estrellas / galaxia | 9k / 32k | 5.5k / 18k | 2.8k / 8k | fondo CSS |

`PerformanceMonitor` mide FPS en ventanas de 2 s. Tras dos ventanas seguidas por debajo de 45 FPS baja un nivel en modo *auto* y avisa con un toast accesible. Nunca vuelve a subir, así que no puede oscilar. El usuario puede fijar el nivel en el selector del header (se guarda en `localStorage`).

## 6. Accesibilidad

- **`prefers-reduced-motion`**: arranca en modo sin 3D, sin Lenis y sin animaciones de entrada. Un script inline en `<head>` aplica el layout compacto antes del primer pintado, sin reflow. El usuario puede activar el 3D a mano.
- **Modo sin 3D**: la misma página con secciones compactas y las habilidades/proyectos en rejilla.
- **Navegación**: skip link, `<nav>` con `aria-current`, anclas que vuelan la cámara y luego **mueven el foco** al título de la sección, `:focus-visible` en todo.
- **Pasos**: todas las tarjetas existen en el DOM. Las inactivas se atenúan, pero `:focus-within` las muestra al 100 %, y el tabulador desplaza la página, lo que a su vez mueve la cámara.
- **Formulario**: etiquetas reales, `aria-invalid`, estado en `role="status"`.
- Medidores de habilidad con `role="meter"` y valores ARIA.

## 7. Efectos visuales

- **Bloom** (mipmap blur) sobre valores HDR (>1) que emiten los shaders de estrellas, anillos y portal.
- **Depth of Field** con autofocus en el objeto mirado (`sceneRefs.focusPoint`); solo en nivel alto.
- **Niebla volumétrica**: sprites instanciados de fBm que se disuelven al entrar la cámara, más tres bancos de bruma entre estaciones.
- **Lens flare** anamórfico procedural y **lente gravitacional** del agujero de gusano como efecto `mainUv` fusionado en el mismo pase (sin pase extra).
- **Estelas de velocidad**: el mismo polvo dibujado como líneas estiradas según la velocidad real de la cámara.

## 8. Contenido pendiente

- `src/data/experience.ts`: **todos los valores son placeholders `[entre corchetes]`**.
- `src/data/skills.ts`: niveles y descripciones son estimaciones editables.
- `src/data/site.ts`: `email` vacío (oculta el bloque) y la lista de intereses.

## 9. Mejoras propuestas

1. **KTX2/Basis** para cualquier textura futura (compresión en GPU; `KTX2Loader` con transcoder en worker).
2. **Planetas por impostor**: renderizar cada planeta una vez a una textura y dibujarlo como sprite cuando esté lejos. Divide por ~3 el coste del sistema de habilidades.
3. **Audio espacial opcional** (Web Audio, apagado por defecto): drones ambientales por estación.
4. **God rays** de la estrella del hero con `GodRaysEffect` en nivel alto.
5. **Transición de "salto"** al pulsar un enlace del menú lejano: FOV que se abre y estelas más largas durante `lenis.scrollTo`.
6. **OffscreenCanvas + worker** para R3F (`@react-three/offscreen`) en navegadores compatibles, sacando el render del hilo principal como hacía el starfield anterior.
7. **Imagen OG** generada del hero 3D en build (Playwright) en lugar de `og-image.jpg` estática.
