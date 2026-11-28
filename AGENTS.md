# AGENTS.md — Contexto técnico del proyecto

Sistema de inventario y punto de venta para **JD Store** (prendas deportivas).
Aplicación **100 % Web/PWA**: no existen builds nativos ni carpetas `ios/`/`android/`.

## Stack

- **Expo SDK 58** (`expo ~58.0.20`) con salida web (`expo export --platform web`).
- **React 19** + **TypeScript** en modo `strict` (`npx tsc --noEmit` debe dar 0 errores).
- **Firebase JS SDK 13**: Authentication (email/password) + **Firestore** (sin Realtime Database).
- **Cloudflare R2** para imágenes de productos, mediante el Worker
  `inventario-r2-upload.kasakasports.workers.dev` (`src/services/storage.ts`).
- Iconos `lucide-react-native`; estado global por props/contexto, sin Redux ni Zustand.

## Estructura real

```
App.tsx                     Navegación por estado (activeTab). NO usa Expo Router.
index.tsx                   Entry point de Expo.
src/screens/                Pantallas (POS, historial, inventario, apartados, catálogo...).
src/components/             Modales y componentes reutilizables.
src/services/               Acceso a Firestore/Firebase (salesHistoryService, productService...).
src/utils/                  Pricing, fechas, alertas, impresión, imágenes.
src/context/AuthContext.tsx Sesión + rol del usuario.
src/types/                  Tipos de dominio (Product, Sale, Seller, Combo...).
public/                     Assets PWA (manifest, service worker, iconos).
dist/                       Build web generado; no editar a mano.
```

### Navegación

- No hay Expo Router en uso: `App.tsx` mantiene `activeTab` (`inventory`, `shelves`,
  `sales`, `layaways`, `history`, `sellers`, `analytics`) y renderiza la pantalla
  correspondiente. No crear rutas en `src/app/`.
- Pestañas de dueño (`sellers`, `analytics`) se ocultan y bloquean para `seller`.
- El catálogo público se abre desde `PublicCatalogScreen` sin autenticación.

## Modelo de datos (Firestore)

| Colección | Uso |
|---|---|
| `products` | Prendas, variantes color/talla, stock, `purchasePrice`, `code`, `deleted`. |
| `sales` | Ventas y recibos. `items`, `subtotal`, `discount`, `total`, tasas, `status`. |
| `layaways` | Apartados (stand-by hasta completar el saldo). |
| `shelves` | Estantes y mapa de bodega. |
| `combos` | Combos con precio especial. |
| `sellers` | Vendedores seleccionables en el POS. |
| `settings/rates` | Tasas centralizadas `eurToBsRate` / `usdToBsRate`. |
| `users` | Perfil, `role` (`owner` \| `seller`) e `isActive`. |

## Reglas de negocio vigentes

### Precios y mayor

- El umbral de **mayor es global: 6 piezas** en el carrito.
- Los **Conjuntos cuentan ×2** piezas para el umbral (`getPieceMultiplier`).
- **Nunca inventar precios**: si un producto no tiene precio configurado, no se
  asume un valor; se conserva el precio explícito o se deja sin definir.
- El descuento del POS puede ser porcentaje, monto fijo USD o monto en €; el total
  siempre es `max(0, subtotal - descuento)`.

### Tasas

- Fuente única: documento **`settings/rates`** (`eurToBsRate`, `usdToBsRate`).
- Se consultan automáticamente en `ve.dolarapi.com` (`settingsService.fetchVenezuelaRates`)
  y el dueño puede sobrescribirlas manualmente (`saveRates`).
- Cada venta guarda las tasas aplicadas para que el recibo y las ediciones sean
  reproducibles. Al editar una venta se pueden cambiar las tasas y se recalculan
  `totalBS` / `totalBSRef`.

### Apartados (layaways)

- Nacen en **stand-by**: descuentan stock al crearse.
- Al llegar a saldo 0 se oficializan como documento en **`sales`**.
- La oficialización **no vuelve a descontar stock** (el descuento ya ocurrió al
  crear el apartado).

### Roles

- `owner`: acceso total, incluida edición/anulación de ventas y resincronización
  de ganancias.
- `seller`: puede vender, consultar historial y operar inventario, pero **no puede
  editar ni anular ventas**. La validación real está en `assertOwner()` y en
  `firestore.rules` (no solo en la UI).

### Transacciones y stock

- En `runTransaction`: **todas las lecturas antes de cualquier escritura**.
- El stock nunca puede quedar negativo. Si una operación offline dejaría stock
  negativo, se marca como **`conflict`** y se resuelve manualmente; no se fuerza
  la escritura.
- Las ventas offline se encolan y sincronizan con `offlineSyncService`.

## Comandos

```bash
npx tsc --noEmit                  # verificación obligatoria de tipos (0 errores)
npx expo export --platform web    # verificación obligatoria del build web/PWA
npx expo start --web              # desarrollo local
npx expo install <paquete>        # instalar dependencias compatibles con SDK 58
```

No usar `npm install`/`yarn add` para paquetes de Expo: `expo install` resuelve la
versión compatible con el SDK.

## Convenciones de trabajo

- Reutilizar los servicios existentes; no duplicar lógica de precios ni de tasas.
- Los servicios normalizan Firestore (`normalizeSaleDoc`) antes de exponer datos.
- Los cambios de stock/ventas deben ser idempotentes y tolerantes a fallos parciales.
- Formato monetario con `roundMoney` (`src/utils/pricingUtils.ts`).
- Antes de cerrar una tarea: `npx tsc --noEmit` y `npx expo export --platform web`.
