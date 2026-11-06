# Arena de ventas 3D — Black Sheep

Tablero de ventas en 3D: un podio con el TOP 1, 2 y 3 como ovejas guerreras animadas. Abajo van las tarjetas del 4º lugar en adelante, junto con los KPIs, la meta del mes, las últimas ventas y un festejo cuando entra una venta.

Al abrir la página sola trabaja en **modo demo**, con ventas inventadas, así que no necesitas ninguna cuenta para verla ni para trabajar en el diseño.

## Cómo abrirla

Tiene que servirse con un servidor local, porque los modelos 3D no cargan si haces doble clic en el HTML. Desde esta carpeta:

```
npx http-server -c-1 -p 8080
```

Después abre:

| Dirección | Qué muestra |
|---|---|
| http://localhost:8080/ | La arena normal |
| http://localhost:8080/?demo=1 | El TOP 1 corregido, en revisión, con sombras y texturas en calidad alta |
| http://localhost:8080/?foco=1 | La cámara de cerca a la oveja 1 (también `foco=2` o `foco=3`). Con `&ang=40` la rodeas |
| http://localhost:8080/visor.html | Las 3 ovejas sueltas para girarlas con el mouse |

Si no tienes Node, sirve cualquier servidor estático. Por ejemplo: `python -m http.server 8080`.

## Qué hay en la carpeta

| Archivo | Qué es |
|---|---|
| `index.html` | La estructura de la página: KPIs, arena, meta, tarjetas y festejo |
| `styles.css` | Todo el diseño: colores, letras y tamaños |
| `app.js` | La escena 3D con three.js 0.160 y los datos |
| `config.js` | Meta del mes, título y fuente de datos (vacía = demo) |
| `assets/oveja-1/2/3.glb` | Las 3 ovejas en 3D, con esqueleto y 4 animaciones: reposo, saludo, festejo y aplauso |
| `assets/demo/oveja-1.glb` | El TOP 1 corregido que está en revisión |
| `assets/corona-plata.glb`, `assets/corona-bronce.glb` | Las coronas del 2º y 3º lugar |
| `referencias/` | Los dibujos originales de cada oveja y sus versiones con los brazos abiertos |

### Dentro de `app.js`

- **Luces:** la función `foco()` y las luces de contraluz.
- **Brillo de las ovejas:** dentro de `figura()`.
- **Metal de las coronas:** `METAL_CORONA`.
- **Aura del campeón:** `texAnillos` y `texRayos`.
- **Bloom:** `UnrealBloomPass`.

## Reglas de la marca

- **Colores:** fondo negro `#0b0b0c` con oro como único acento (`#b08d57` y `#e2c48d`). Plata para el 2º lugar y bronce para el 3º.
- **Letras:** Archivo para títulos e Inter para texto (Google Fonts).
- **Idioma:** todo en español.
- **Ovejas:** son las de los dibujos de `referencias/`. Se pueden mejorar luces, materiales y efectos, pero no cambiar a los personajes.

## Al terminar

Devuelve la carpeta completa. Esta arena se publica también dentro del portal de la agencia, así que:

- No cambies los nombres de archivos ni de los `id` del HTML, porque el código los usa.
- No quites la parte de "Ventas del portal" en `app.js`.
