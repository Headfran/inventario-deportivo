// Paleta y estilos base compartidos por toda la app
export const C = {
   bg: '#0A0A0A', surface: '#121212', raised: '#1A1A1A', border: '#262626', line: '#2E2E2E',
   white: '#FFFFFF', light: '#E8E8E8', soft: '#BDBDBD', mute: '#8A8A8A', dim: '#6A6A6A', ink: '#5A5A5A',
};

export const caps = { textTransform: 'uppercase' as const, letterSpacing: 2 };
export const box = { backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, borderRadius: 2 };
export const activeBox = { backgroundColor: C.light, borderColor: C.light };
export const activeText = { color: C.bg, fontWeight: '900' as const };
export const label = { ...caps, fontSize: 10, fontWeight: 'bold' as const, color: C.mute, marginBottom: 6 };

export const btn = {
   flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const,
   paddingVertical: 12, borderRadius: 2,
};
export const btnText = { ...caps, fontSize: 12, fontWeight: '900' as const };

export const overlay = {
   flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' as const,
   alignItems: 'center' as const, padding: 16,
};
export const modalCard = {
   width: '100%' as const, maxWidth: 440, maxHeight: '85%' as const, backgroundColor: C.surface,
   borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: 'hidden' as const,
};