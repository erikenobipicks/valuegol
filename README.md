# PicksGuru — Landing page

Landing comercial para una plataforma de análisis de fútbol en directo con scanner live, estrategias personalizadas y alertas por Telegram.

**Stack:** HTML + CSS + JavaScript vanilla. Sin build, sin dependencias, sin frameworks. Abre `index.html` directamente en el navegador.

## Estructura

```
picksguru/
├── index.html            # Página completa (14 secciones) + SEO + JSON-LD
├── assets/
│   ├── css/styles.css     # Tokens (variables), componentes y responsive
│   └── js/
│       ├── i18n.js        # Infraestructura multiidioma (selector + diccionarios)
│       └── main.js        # Header, menú móvil, scroll-reveal, FAQ
├── robots.txt
├── sitemap.xml
└── README.md
```

## Multiidioma (i18n)

La web trae la **infraestructura lista**, en español como idioma base. El selector
de idioma del header se genera automáticamente a partir de los idiomas que existan.

**Para añadir un idioma (p. ej. inglés):**
1. Abre `assets/js/i18n.js`.
2. Copia el objeto `es` completo dentro de `translations` y renómbralo `en`; traduce
   **solo los valores** (no las claves).
3. Añade su nombre en `LANGS` (`en: "English"`).
4. Hecho: el selector mostrará `ES / EN` y recordará la elección del usuario.

**Para traducir un texto nuevo:** añade `data-i18n="seccion.clave"` al elemento en
`index.html` y la misma clave en los diccionarios. Las claves que falten en un idioma
**caen al texto del HTML** (nunca se queda en blanco). Para atributos:
`data-i18n-attr="placeholder:cf.email"`.

## Cómo retematizar (rápido)

Todo el aspecto vive en variables CSS al inicio de `assets/css/styles.css` (`:root`):

- `--bg`, `--bg-alt`, `--surface` → fondos oscuros
- `--cyan`, `--green`, `--accent-grad` → acentos
- `--font`, `--radius`, `--space` → tipografía, redondeos y espaciados

Cambia esos valores y la web entera se actualiza.

---

## ⚠️ Qué debes sustituir manualmente

### Marca y dominio
- **"PicksGuru"**: aparece en `index.html` (header, footer, JSON-LD, `<title>`). Busca y reemplaza por tu marca.
- **`https://www.tudominio.com/`**: cámbialo en `index.html` (canonical, Open Graph, Twitter), `robots.txt` y `sitemap.xml`.
- **Favicon / logo**: el logo es un SVG inline en el header y footer. El favicon es un `data:` SVG en `<head>`. Sustitúyelos por tu marca real.

### SEO / redes
- `<title>` y `<meta name="description">` en `<head>`.
- Imagen Open Graph: `assets/img/og-image.jpg` (créala, 1200×630 px). Actualiza las metas `og:image` y `twitter:image`.
- JSON-LD: revisa nombre, descripción y precios en los dos bloques `application/ld+json`.

### Textos de marketing
- **Hero** (sección 2): H1, subtítulo y CTAs ya rellenos con tu contenido orientativo.
- **Testimonios** (sección 10): ⚠️ **son ficticios y editables**. Sustitúyelos por opiniones reales o etiquétalos claramente como ejemplos. Nombres, iniciales (`avatar`) y roles.
- **Precios** (sección 11): importes (`0€`, `19€`), nombres de plan y listas de características.
- **Barra de logos** (sección logos): "+50 ligas", "+30 métricas"… ajústalo a datos reales.

### Datos de los mockups (ficticios, decorativos)
Los mockups (dashboard, notificación Telegram, tabla del scanner, gráfico de momentum) usan **equipos y cifras inventadas** ("Rayo Verde", "Atlético Azul"…). Son ilustrativos. Cámbialos si quieres, pero no representan datos reales.

### Enlaces y formulario
- **Footer legal**: los enlaces "Aviso legal", "Privacidad", "Cookies", "Términos" apuntan a `#`. Enlaza tus páginas reales (obligatorio legalmente).
- **Formulario CTA final**: `action="#"`. Conéctalo a tu backend / proveedor de email.
- Enlaces "Blog" y "Contacto" del footer también apuntan a `#`.

### Disclaimer legal
El footer incluye un aviso (+18, juego responsable, no es consejo de apuesta). Revísalo con tu asesoría legal según tu jurisdicción antes de publicar.

---

## Accesibilidad y rendimiento

- HTML semántico (`header`, `main`, `section[aria-labelledby]`, `nav[aria-label]`, `footer`).
- Skip-link, `aria-expanded` en el menú, `aria-label` en gráficos e iconos, foco visible.
- Respeta `prefers-reduced-motion`.
- 0 peticiones externas: fuentes de sistema, mockups en SVG inline, JS diferido (`defer`).

> Tipografía: usa "Inter" si está disponible y, si no, la fuente del sistema. Para forzar Inter, añade el `<link>` de Google Fonts en `<head>` (añadiría una petición externa).
