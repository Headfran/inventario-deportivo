import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
   size?: number;
   color?: string;
   strokeWidth?: number;
}

const baseProps = (size: number, color: string, sw: number) => ({
   width: size,
   height: size,
   viewBox: '0 0 24 24',
   fill: 'none' as const,
   stroke: color,
   strokeWidth: sw,
   strokeLinecap: 'round' as const,
   strokeLinejoin: 'round' as const,
});

// Camiseta / franela / camisa / franelilla / chemise
export const IconTshirt: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M7 4L4 6L2 9L5 11L6 10V20H18V10L19 11L22 9L20 6L17 4C17 5 15 6 12 6C9 6 7 5 7 4Z" />
   </Svg>
);

// Sudadera / suéter / hoodie
export const IconHoodie: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M7 5L4 7L2 10L5 12L6 11V21H18V11L19 12L22 10L20 7L17 5" />
      <Path d="M7 5C7 3 9.5 1.5 12 1.5C14.5 1.5 17 3 17 5C17 6.5 15 7 12 7C9 7 7 6.5 7 5Z" />
      <Path d="M9 14H15V18H9Z" />
   </Svg>
);

// Chaqueta / abrigo
export const IconJacket: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M7 4L4 6L2 9L5 11L6 10V21H18V10L19 11L22 9L20 6L17 4C17 5 15 6 12 6C9 6 7 5 7 4Z" />
      <Path d="M12 6V21" />
      <Path d="M8 6L10.5 10" />
      <Path d="M16 6L13.5 10" />
   </Svg>
);

// Short / bermuda
export const IconShorts: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M4 6H20L18.5 17H14L13 10H11L10 17H5.5L4 6Z" />
   </Svg>
);

// Pantalón / mono (jogger) / jean
export const IconPants: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M5 3H19L17.5 21H14L12.5 11H11.5L10 21H6.5L5 3Z" />
   </Svg>
);

// Conjunto (top + bottom)
export const IconOutfit: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M9 3L6.5 4.5L5 6.5L6.5 8L7.5 7V10H16.5V7L17.5 8L19 6.5L17.5 4.5L15 3C15 3.8 13.7 4.5 12 4.5C10.3 4.5 9 3.8 9 3Z" />
      <Path d="M8 12H16L15 20H13L12.3 15.5H11.7L11 20H9L8 12Z" />
   </Svg>
);

// Zapato / calzado (perfil de sneaker)
export const IconShoe: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M2 15V13L4 12H8L12 8H15L16 10L20 11C21.5 11.3 22 12 22 13V15H2Z" />
      <Path d="M2 15H22" />
   </Svg>
);

// Accesorios (bolso / cartera)
export const IconAccessories: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M5 8H19L20 21H4L5 8Z" />
      <Path d="M8.5 8V6C8.5 4 10 2.5 12 2.5C14 2.5 15.5 4 15.5 6V8" />
   </Svg>
);

// Premium / AAA (corona)
export const IconPremium: React.FC<IconProps> = ({ size = 18, color = '#000', strokeWidth = 2 }) => (
   <Svg {...baseProps(size, color, strokeWidth)}>
      <Path d="M3 18L5 10L9 14L12 8L15 14L19 10L21 18H3Z" />
      <Path d="M3 18V20H21V18" />
   </Svg>
);
