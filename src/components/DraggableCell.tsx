import React, { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

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
}) => {
   const viewRef = useRef<any>(null);

   const register = () => {
      const node: any = viewRef.current;
      if (!node) return;

      if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
         const r = node.getBoundingClientRect();
         onRegisterLayout(cellKey, {
            x: r.left,
            y: r.top,
            width: r.width,
            height: r.height,
         });
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

   const jsPress = () => onPress();
   const jsStart = (x: number, y: number) => onDragStart(x, y);
   const jsMove = (x: number, y: number) => onDragMove(x, y);
   const jsEnd = (x: number, y: number) => onDragEnd(x, y);

   const pan = Gesture.Pan()
      .enabled(!disabled)
      .activateAfterLongPress(Platform.OS === 'web' ? 0 : 150)
      .onStart((e) => runOnJS(jsStart)(e.absoluteX, e.absoluteY))
      .onUpdate((e) => runOnJS(jsMove)(e.absoluteX, e.absoluteY))
      .onEnd((e) => runOnJS(jsEnd)(e.absoluteX, e.absoluteY));

   const tap = Gesture.Tap().onEnd((_e, success) => {
      if (success) runOnJS(jsPress)();
   });

   // Race: el que se active primero gana.
   // - Un tap rápido nunca activa el Pan (delay 150 ms) → gana Tap.
   // - Mantener presionado activa Pan y cancela Tap → nunca dispara onPress.
   const composed = Gesture.Race(pan, tap);

   return (
      <GestureDetector gesture={composed}>
         <View ref={viewRef} onLayout={register} style={style}>
            {children}
         </View>
      </GestureDetector>
   );
};
