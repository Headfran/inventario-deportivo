import React, { useEffect, useRef } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
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
   isDragEnabled: boolean;
   style?: any;
   children: React.ReactNode;
   renderHandle?: () => React.ReactNode;
   onRegisterLayout: (key: string, layout: CellLayout) => void;
   onPress: () => void;
   onDragStart: (absX: number, absY: number) => void;
   onDragMove: (absX: number, absY: number) => void;
   onDragEnd: (absX: number, absY: number) => void;

   dragX?: SharedValue<number>;
   dragY?: SharedValue<number>;
   isDragging?: SharedValue<boolean>;
}

export const DraggableCell: React.FC<Props> = ({
   cellKey,
   disabled,
   isDragEnabled,
   style,
   children,
   renderHandle,
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
   const hasDragged = useRef(false);

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

   // FIX CRÍTICO: ¡0 Milisegundos de retraso! Como el gesto ahora solo está en el icono,
   // sabemos que si el usuario lo toca, es porque quiere arrastrar sí o sí.
   const panUI = Gesture.Pan()
      .enabled(!disabled && isDragEnabled)
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

   const panJS = Gesture.Pan()
      .enabled(!disabled && isDragEnabled)
      .onTouchesDown(() => {
         hasDragged.current = false;
      })
      .onStart((e) => {
         hasDragged.current = true;
         onDragStart(e.absoluteX, e.absoluteY);
      })
      .onUpdate((e) => {
         onDragMove(e.absoluteX, e.absoluteY);
      })
      .onEnd((e) => {
         onDragEnd(e.absoluteX, e.absoluteY);
      })
      .runOnJS(true);

   const composedPan = Gesture.Simultaneous(panUI, panJS);

   const handlePress = () => {
      if (hasDragged.current) {
         hasDragged.current = false;
         return;
      }
      onPress();
   };

   return (
      <TouchableOpacity
         ref={viewRef}
         onLayout={register}
         activeOpacity={0.7}
         onPress={handlePress}
         disabled={disabled}
         style={style}
         delayPressIn={150}
      >
         {/* Contenido normal de la celda */}
         {children}

         {/* ÁREA DE ARRASTRE EXCLUSIVA (Solo visible si el drag está activo y pasamos un icono) */}
         {isDragEnabled && renderHandle && (
            <GestureDetector gesture={composedPan}>
               <View style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 50, // Hitbox táctil grande invisible
                  height: 50,
                  zIndex: 20,
                  justifyContent: 'flex-start',
                  alignItems: 'flex-end',
                  backgroundColor: 'transparent'
               }}>
                  {/* Renderizamos el icono visible aquí dentro */}
                  {renderHandle()}
               </View>
            </GestureDetector>
         )}
      </TouchableOpacity>
   );
};
