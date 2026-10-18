import { useRef, useEffect } from 'react';
import { Platform, Animated, Easing, AccessibilityInfo } from 'react-native';

// ---- Color: negro, blanco y azul marino ----
export const BLUE = { 900: '#050F26', 800: '#0A1E4A', 700: '#10306E', 600: '#1A4694', 300: '#9DB8EA' };

// Catálogo público (claro)
export const LIGHT = {
   bg: '#FFFFFF', surface: '#F2F5FA', ink: '#0A0A0A', inkSoft: '#454C5C', inkMute: '#7A8294', line: '#E1E6EF',
   accent: BLUE[800], accentHi: BLUE[600], onAccent: '#FFFFFF', solid: '#0A0A0A', onSolid: '#FFFFFF',
   imgBg: '#E8EDF6', pill: 'rgba(255,255,255,0.92)', overlay: 'rgba(5,15,38,0.62)', bar: '#050505', onBar: '#FFFFFF',
};

// Panel del vendedor (oscuro)
export const DARK: typeof LIGHT = {
   bg: '#05070C', surface: '#0C1222', ink: '#FFFFFF', inkSoft: '#B6BED0', inkMute: '#7C869B', line: '#1B2540',
   accent: BLUE[700], accentHi: BLUE[600], onAccent: '#FFFFFF', solid: '#FFFFFF', onSolid: '#0A0A0A',
   imgBg: '#111A30', pill: 'rgba(5,7,12,0.78)', overlay: 'rgba(0,0,0,0.78)', bar: '#000000', onBar: '#FFFFFF',
};
export type Tone = typeof LIGHT;

// ---- Tipografía: Barlow Condensed (se carga solo en web; en celular usa la letra del sistema) ----
export const display: any = Platform.OS === 'web'
   ? { fontFamily: "'Barlow Condensed', 'Arial Narrow', Impact, sans-serif" }
   : {};

if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('barlow-font')) {
   const link = document.createElement('link');
   link.id = 'barlow-font';
   link.rel = 'stylesheet';
   link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap';
   document.head.appendChild(link);
}

// ---- Movimiento: ease-out fuerte, nunca ease-in ----
export const ease = Easing.bezier(0.23, 1, 0.32, 1);
export const nd = Platform.OS !== 'web';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((r) => { reduceMotion = r; });
export const reduced = () => reduceMotion;

/** Entrada de modales: en celular sube desde abajo, en PC aparece escalando desde 0.96 */
export const useEnter = (visible: boolean, sheet: boolean) => {
   const v = useRef(new Animated.Value(0)).current;
   useEffect(() => {
      if (!visible) {
         v.setValue(0);
         return;
      }
      if (reduceMotion) {
         v.setValue(1);
         return;
      }
      Animated.timing(v, { toValue: 1, duration: 240, easing: ease, useNativeDriver: nd }).start();
   }, [visible]);
   return {
      opacity: v,
      transform: [
         { scale: v.interpolate({ inputRange: [0, 1], outputRange: [sheet ? 1 : 0.96, 1] }) },
         { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [sheet ? 48 : 12, 0] }) },
      ],
   };
};

// ---- Utilidades compartidas ----
const COLOR_MAP: Record<string, string> = {
   negro: '#000000', black: '#000000', blanco: '#ffffff', white: '#ffffff', rojo: '#ef4444', red: '#ef4444',
   azul: '#2563eb', blue: '#2563eb', 'azul marino': '#1e3a8a', navy: '#1e3a8a', verde: '#22c55e', green: '#22c55e',
   amarillo: '#eab308', yellow: '#eab308', gris: '#64748b', gray: '#64748b', grey: '#64748b', 'gris oscuro': '#334155',
   'gris claro': '#cbd5e1', rosado: '#ec4899', rosa: '#ec4899', pink: '#ec4899', morado: '#a855f7', purpura: '#a855f7',
   purple: '#a855f7', naranja: '#f97316', orange: '#f97316', beige: '#fef3c7', arena: '#fef3c7', marron: '#78350f',
   cafe: '#78350f', brown: '#78350f', vinotinto: '#881337', burgundy: '#881337',
};
export const getColorHex = (colorName: string): string => COLOR_MAP[colorName.toLowerCase().trim()] || '#94a3b8';
// Panel del vendedor: solo negro y blanco (los grises son blanco con transparencia)
export const MONO: typeof LIGHT = {
   bg: '#000000', surface: 'rgba(255,255,255,0.05)', ink: '#FFFFFF', inkSoft: 'rgba(255,255,255,0.72)',
   inkMute: 'rgba(255,255,255,0.5)', line: 'rgba(255,255,255,0.14)', accent: '#FFFFFF', accentHi: '#FFFFFF',
   onAccent: '#000000', solid: '#FFFFFF', onSolid: '#000000', imgBg: 'rgba(255,255,255,0.08)',
   pill: 'rgba(0,0,0,0.75)', overlay: 'rgba(0,0,0,0.85)', bar: '#000000', onBar: '#FFFFFF',
};