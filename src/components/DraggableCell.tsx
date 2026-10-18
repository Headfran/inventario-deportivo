import React, { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SharedValue } from 'react-native-reanimated';

export interface CellLayout {
   x: number;
   y: number;
   width: number;
   height: number;
}

interface Props {
   cellKey: string;
   disabled?: boolean;
   style?: any;
   children: React.ReactNode;
   onRegisterLayout: (key: string, layout: CellLayout) => void;
   onPress: () => void;
   onDragStart: (absX: number, absY: number) => void;
   onDragMove: (absX: number, absY: number) => void;
   onDragEnd: (absX: number, absY: number) => void;

   // Props inyectados para control 100% nativo de la GPU
   dragX?: SharedValue<number>;
   dragY?: SharedValue<number>;
   isDragging?: SharedValue<boolean>;
}

export const DraggableCell: React.FC<Props> = ({
   cellKey,
   disabled,
   style,
   children,
   onRegisterLayout,
   onPress,
   onDragStart,
   onDragMove,
   onDragEnd,
   dragX,
   dragY,
   isDragging,
}) => {
   const viewRef = useRef<any>(null);

   const register = () => {
      const node: any = viewRef.current;
      if (!node) return;

      if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
         const r = node.getBoundingClientRect();
         onRegisterLayout(cellKey, { x: r.left, y: r.top, width: r.width, height: r.height });
         return;
      }

      if (typeof node.measureInWindow === 'function') {
         node.measureInWindow((x: number, y: number, width: number, height: number) => {
            onRegisterLayout(cellKey, { x, y, width, height });
         });
      }
   };

   useEffect(() => {
      const t = setTimeout(register, 50);
      return () => clearTimeout(t);
   });

   // 1. Toque simple (Tap) usando modificador nativo
   const tap = Gesture.Tap()
      .enabled(!disabled)
      .onEnd((_e, success) => {
         if (success) onPress();
      })
      .runOnJS(true);

   // 2. Gesto de interfaz (UI Thread): 0 latencia, inyecta coordenadas de inmediato
   const panUI = Gesture.Pan()
      .enabled(!disabled)
      .activateAfterLongPress(Platform.OS === 'web' ? 0 : 150)
      .onTouchesDown((e) => {
         'worklet';
         if (dragX) dragX.value = e.allTouches[0].absoluteX;
         if (dragY) dragY.value = e.allTouches[0].absoluteY;
      })
      .onStart((e) => {
         'worklet';
         if (isDragging) isDragging.value = true;
         if (dragX) dragX.value = e.absoluteX;
         if (dragY) dragY.value = e.absoluteY;
      })
      .onUpdate((e) => {
         'worklet';
         if (dragX) dragX.value = e.absoluteX;
         if (dragY) dragY.value = e.absoluteY;
      })
      .onEnd(() => {
         'worklet';
         if (isDragging) isDragging.value = false;
      });

   // 3. Gesto Lógico (JS Thread): Notifica a React en segundo plano
   const panJS = Gesture.Pan()
      .enabled(!disabled)
      .activateAfterLongPress(Platform.OS === 'web' ? 0 : 150)
      .onStart((e) => {
         onDragStart(e.absoluteX, e.absoluteY);
      })
      .onUpdate((e) => {
         onDragMove(e.absoluteX, e.absoluteY);
      })
      .onEnd((e) => {
         onDragEnd(e.absoluteX, e.absoluteY);
      })
      .runOnJS(true);

   // Unimos los gestos para eliminar cualquier tirón
   const composedPan = Gesture.Simultaneous(panUI, panJS);
   const composed = Gesture.Race(composedPan, tap);

   return (
      <GestureDetector gesture={composed}>
         <View ref={viewRef} onLayout={register} style={style}>
            {children}
         </View>
      </GestureDetector>
   );
};
