# Especificación de Diseño: Clon UI/UX Pet Society

**Fecha:** 2026-08-29  
**Estado:** Propuesta aprobada por el usuario  
**Propósito:** Transformar toda la interfaz visual y la experiencia de usuario de la aplicación web en un clon auténtico, inmersivo y responsivo del juego clásico **Pet Society** (Playfish / EA).

---

## 1. Visión General & Objetivos

Transformar la web en una experiencia de juego web unificada (*Single-Screen Game Canvas*) donde:
1. **El Escenario Principal es la Habitación:** La pantalla `/pet` es el centro de todo el juego, con el cuarto decorado, la mascota interactiva, el HUD superior con 4 medidores circulares de necesidades y la barra de herramientas inferior.
2. **Modales In-Game Temáticos:** La Tienda, el Diario de Recuerdos, el Tablón de Misiones y los Ajustes de Notificaciones se abren como elegantes popups integrados dentro del propio juego, sin recargas de página lentas.
3. **Estética Pet Society al 100%:** Bordes gruesos de roble y nogal tallados, botones de caramelo con relieve 3D brillante (*gummy candy buttons*), tipografía amigable (`Baloo 2` y `Quicksand`), fondo de cielo celeste pastel y tonos pergamino.
4. **Voz Rioplatense & Principio Anti-Culpa:** Textos cálidos en tiempo presente (*"¡Qué lindo verte!", "Alimentar", "Bañar", "Sumar un recuerdo"*).

---

## 2. Sistema de Diseño & Tokens Visuales

### Paleta de Colores
* **Madera & Bordes:**
  * Marco exterior nogal oscuro: `#58331A`
  * Borde de madera cálida: `#804A26`
  * Bisel interior y moldura dorada: `#C89B6C` / `#E6B800`
* **Papeles & Fondos:**
  * Fondo exterior del juego (cielo con nubes): Gradiente `#8AD4EB` a `#C5EEF9`
  * Pergamino / Tarjetas de diálogo / Popups: `#FFF9EC`
  * Papel tapiz de la habitación: Rayas verticales `#FDE9C8` y `#F5D8A5`
  * Piso de parquet de madera: `#C89B6C` con zócalo `#6B4226`
* **Botones & Medidores Caramelo:**
  * 🍖 Hambre: Gradiente `#FFA07A` a `#FF6347` (Naranja / Salmón)
  * 😊 Felicidad: Gradiente `#FFB6C1` a `#FF69B4` (Rosa chicle)
  * ⚡ Energía: Gradiente `#C4B5FD` a `#8B5CF6` (Violeta suave)
  * ✨ Higiene: Gradiente `#7EE8DB` a `#20B2AA` (Turquesa burbuja)
  * 🪙 Monedas / Oro: Gradiente `#FCD34D` a `#F59E0B` con brillo blanco superior
  * 💊 Medicina: Gradiente `#FF6F8E` a `#E11D48` (Frasco carmesí)

### Tipografía
* **Display / Títulos / Números / Botones:** `var(--font-display)` (`Baloo 2`), negrita (`font-bold`), con sombra suave `drop-shadow(0 2px 0 rgba(0,0,0,0.2))`.
* **Cuerpo / Textos descriptivos:** `var(--font-sans)` (`Quicksand`), pesos 500 y 600, color tinta `#4A3222`.

### Efectos Físicos de Botones (Estilo Playfish)
* Sombra 3D inferior: `box-shadow: 0 5px 0 #58331A, 0 8px 12px rgba(0,0,0,0.2)`.
* Brillo superior en media luna: pseudo-elemento blanco semitransparente (`rgba(255,255,255,0.35)`).
* Estado activo: `transform: translateY(4px); box-shadow: 0 1px 0 #58331A, 0 3px 6px rgba(0,0,0,0.2)`.

---

## 3. Arquitectura de Componentes de la Pantalla Principal (`/pet`)

```
+-------------------------------------------------------------------------------+
|                             PET SOCIETY GAME STAGE                            |
| +---------------------------------------------------------------------------+ |
| | HUD SUPERIOR: [⭐ Nivel 3] [🐾 Nombre]  [🍖 85%] [😊 90%] [⚡ 70%] [✨ 95%] [🪙 420] | |
| +---------------------------------------------------------------------------+ |
| | ESCENARIO CENTRAL (HABITACIÓN 2.5D):                                       | |
| |   [Papel Tapiz a Rayas / Cuadros de pared]                                | |
| |                                                                           | |
| |             [ 💬 Bocadillo de Diálogo: "¡Tengo un regalo! 🎁" ]            | |
| |                                                                           | |
| |        🛋️ Sofá             🐱 Mascota (Interativa)         🪴 Planta       | |
| |   ======================== PISO DE PARQUET =============================  | |
| +---------------------------------------------------------------------------+ |
| | BARRA DE HERRAMIENTAS INFERIOR (CARE DOCK):                               | |
| |   [🍖 Comer] [🎾 Jugar] [🧼 Bañar] [💤 Dormir] [💊 Remedio] | [🎨] [🏬] [📔] [🎯] | |
| +---------------------------------------------------------------------------+ |
+-------------------------------------------------------------------------------+
```

### 3.1. `PetGameStage.tsx` (Contenedor Maestro)
* Proporción óptima ~3:2 (ej. 960×640 px) centrado horizontal y verticalmente en la ventana.
* En pantallas pequeñas / móviles, escala dinámicamente manteniendo la proporción y la integridad del marco de madera.
* Gestiona el estado de modales abiertos: `activeModal: null | 'tienda' | 'diario' | 'misiones' | 'notificaciones' | 'decorar' | 'streak_reward'`.

### 3.2. `PetHUD.tsx` (Barra Superior)
* **Medallón de Nivel & Vínculo:**
  * Muestra el nivel actual (Niv. 1 a Niv. 10 derivado del `bond_score`), icono de estrella dorada o huella, y barra de progreso.
* **Placa de Nombre:**
  * Cartel de madera tallada con bordes biselados con el nombre de la mascota.
* **4 Medidores Circulares (*Playfish Gauges*):**
  * Componentes SVG circulares animados con el porcentaje exacto y el icono representativo:
    - 🍖 Hambre (`stats.hunger`)
    - 😊 Felicidad (`stats.happiness`)
    - ⚡ Energía (`stats.energy`)
    - ✨ Higiene (`stats.cleanliness`)
  * Tooltip o indicador visual al pasar el cursor o pulsar.
* **Contador de Monedas:**
  * Cápsula dorada con moneda brillante y balance actual `petRow.coins`.

### 3.3. `PetRoomStage.tsx` (Escenario Central)
* Sala 2.5D interactiva:
  * Pared decorada (75% altura superior) y piso de madera (25% inferior) con línea de zócalo.
  * Renderizado de muebles colocados (`placed_items`).
  * Mascota (`CatSprite`) con sombra elíptica, movimiento al hacer clic en el suelo, estados de ánimo según estadísticas.
  * Bocadillo de diálogo de apego (`PetSpeechBubble`) con interacción directa.
  * Si está en etapa de huevo (`lifeStage === 'egg'`), muestra el nido con el huevo incubando.

### 3.4. `PetCareDock.tsx` (Barra Inferior de Cuidado & Navegación)
* **Sección de Cuidado Físico:**
  * Botón 🍖 **Alimentar** (dispara Server Action `feed`, muestra animación de comida flotante).
  * Botón 🎾 **Jugar** (dispara Server Action `play`, eleva la felicidad con corazones).
  * Botón 🧼 **Bañar** (dispara Server Action `bathe`, lanza burbujas sobre la mascota).
  * Botón 💤 **Dormir / Despertar** (dispara `toggleSleep`, atenúa la luz de la habitación con filtro nocturno).
  * Botón 💊 **Medicina** (se resalta con pulso brillante cuando `isSick === true`).
* **Sección de Menús & Modales:**
  * Botón 🎨 **Decorar** (despliega la bandeja de muebles en la parte inferior de la sala).
  * Botón 🏬 **Tienda** (abre el modal de la tienda del pueblo).
  * Botón 📔 **Diario** (abre el álbum de recuerdos).
  * Botón 🎯 **Misiones** (abre el tablón de misiones diarias y semanales).
  * Botón ✉️ **Notificaciones** (abre el pergamino de configuración de avisos).

---

## 4. Modales In-Game Integrados

Todos los modales se despliegan sobre el lienzo con animación de apertura elástica (*zoom-in bounce*), fondo oscurecido semitransparente con desenfoque suave (*backdrop blur*) y marco de madera doble con botón de cierre de cruz roja en la esquina superior derecha (`✕`).

### 4.1. `TiendaModal.tsx`
* Estantería con los ítems disponibles del catálogo (`ITEMS` en `lib/items.ts`).
* Muestra el emoji gigante, nombre del mueble, costo en monedas 🪙 y botón *"Comprar"* o etiqueta *"✅ Ya lo tenés"*.
* Actualiza el saldo en tiempo real al comprar.

### 4.2. `DiarioModal.tsx`
* Álbum encuadernado en cuero marrón con hojas de pergamino.
* Formulario superior para escribir un recuerdo nuevo (`AddNoteForm`).
* Lista cronológica de eventos (nacimiento, crecimiento, enfermedades superadas, cartas de racha).

### 4.3. `MisionesModal.tsx`
* Tablón de anuncios de madera rústica con chinchetas.
* Misiones diarias y semanales con barra de progreso (`0/1`, `3/5`), recompensa en monedas y sello de *"✅ Completada"*.

### 4.4. `NotificacionesModal.tsx`
* Pergamino con los interruptores de email para Bono Diario y Regalos por Racha.

### 4.5. `StreakRewardModal.tsx`
* Cofre / Caja de regalo dorada que se abre al alcanzar hitos de 3, 7, 14, 30+ días.

---

## 5. Páginas de Autenticación & Onboarding

* **`/login` (Página de Bienvenida):**
  * Marco de madera estilo cabina de entrada de Pet Society con logo brillante `🐾 Pets Forever`.
  * Pestañas o tarjetas gemelas *"Iniciar sesión"* e *"Crear cuenta"* con botones de caramelo.
* **`/onboarding` (Creación de Mascota):**
  * Estudio fotográfico / Laboratorio mágico para nombrar a la mascota y subir sus fotos de referencia con previsualización en marcos dorados.

---

## 6. Verificación & Criterios de Éxito

1. **Fidelidad Visual:** La interfaz emula de manera indistinguible el estilo, proporciones, marcos de madera y botones gomosos de Pet Society.
2. **Interactividad Fluida:** Todas las acciones de cuidado (`feed`, `play`, `bathe`, `toggleSleep`, `medicine`) y modales (`tienda`, `diario`, `misiones`) funcionan instantáneamente sin recargas completas del navegador.
3. **Responsive:** Adaptación perfecta tanto en monitores de escritorio (pantalla centrada enmarcada) como en teléfonos móviles (ajuste de escala sin overflow).
4. **Compatibilidad:** 100% de los tests existentes (`npm run test`) pasando sin regresiones y build de Next.js (`npm run build`) compilado con 0 errores.
