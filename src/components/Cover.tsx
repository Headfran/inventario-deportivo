import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

// Foto de la prenda; si no hay foto muestra la inicial (sin pedir nada a internet)
export const Cover = ({ uri, name, style, bg, fg }: { uri?: string; name: string; style?: any; bg?: string; fg?: string }) =>
   uri ? (
      <Image source={{ uri }} style={style} resizeMode="cover" />
   ) : (
      <View style={[style, styles.empty, bg ? { backgroundColor: bg } : null]}>
         <Text style={[styles.letter, fg ? { color: fg } : null]}>{(name || '?').charAt(0).toUpperCase()}</Text>
      </View>
   );

const styles = StyleSheet.create({
   empty: { justifyContent: 'center', alignItems: 'center', backgroundColor: C.raised },
   letter: { fontSize: 40, fontWeight: '900', color: '#2A2A2A' },
});