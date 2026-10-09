import React, { useEffect, useState } from 'react';
import {
   View,
   Text,
   FlatList,
   TouchableOpacity,
   Image,
   StyleSheet,
   Modal
} from 'react-native';
import { Product } from '../types/inventory';
import { subscribeToProducts, deleteProduct } from '../services/productService';
import { ProductFormScreen } from './ProductFormScreen';
import { showConfirm } from '../utils/alert';

export const InventoryListScreen = () => {
   const [products, setProducts] = useState<Product[]>([]);
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [isFormOpen, setIsFormOpen] = useState(false);

   useEffect(() => {
      const unsubscribe = subscribeToProducts((data) => {
         setProducts(data);
      });
      return () => unsubscribe();
   }, []);

   const handleEdit = (product: Product) => {
      setSelectedProduct(product);
      setIsFormOpen(true);
   };

   const handleCreate = () => {
      setSelectedProduct(null);
      setIsFormOpen(true);
   };

   // Reemplazo de Alert.alert por showConfirm compatible con Web (window.confirm)
   const handleDelete = (product: Product) => {
      showConfirm(
         'Eliminar Prenda',
         `¿Estás seguro de eliminar "${product.name}"? Se borrará la prenda y sus imágenes del servidor.`,
         async () => {
            await deleteProduct(product);
         }
      );
   };

   const calculateTotalStock = (product: Product) => {
      if (!product || !Array.isArray(product.variants)) return 0;

      return product.variants.reduce((accColor, currColor) => {
         if (!currColor) return accColor;

         // 1. Nueva estructura: variante agrupada por color con sub-arreglo 'sizes'
         if (Array.isArray(currColor.sizes)) {
            const colorStock = currColor.sizes.reduce(
               (accSize, currSize) => accSize + (Number(currSize?.stock) || 0),
               0
            );
            return accColor + colorStock;
         }

         // 2. Compatibilidad con datos viejos creados antes del cambio (currColor.stock directo)
         if (typeof (currColor as any).stock === 'number') {
            return accColor + ((currColor as any).stock || 0);
         }

         return accColor;
      }, 0);
   };

   return (
      <View style={styles.container}>
         {/* Encabezado del inventario */}
         <View style={styles.topActions}>
            <Text style={styles.productCount}>{products.length} prendas registradas</Text>
            <TouchableOpacity style={styles.newBtn} onPress={handleCreate}>
               <Text style={styles.newBtnText}>+ Nueva Prenda</Text>
            </TouchableOpacity>
         </View>

         {/* Lista de productos */}
         <FlatList
            data={products}
            keyExtractor={(item) => item.id || item.code}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
               const totalStock = calculateTotalStock(item);
               const mainImage = item.images[0] || 'https://via.placeholder.com/100?text=Sin+Foto';

               return (
                  <View style={styles.card}>
                     <Image source={{ uri: mainImage }} style={styles.cardImage} />

                     <View style={styles.cardBody}>
                        <View style={styles.cardHeader}>
                           <Text style={styles.brand}>{item.brand}</Text>
                           <Text style={styles.code}>{item.code}</Text>
                        </View>

                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.price}>${item.price.toFixed(2)}</Text>

                        <View style={styles.stockBadgeContainer}>
                           <View style={[
                              styles.stockBadge,
                              totalStock === 0 ? styles.stockEmpty : styles.stockAvailable
                           ]}>
                              <Text style={styles.stockText}>
                                 {totalStock === 0 ? 'AGOTADO' : `Stock: ${totalStock} uds.`}
                              </Text>
                           </View>
                           <Text style={styles.variantCount}>
                              {(item.variants || []).length} variante(s)
                           </Text>
                        </View>
                     </View>

                     <View style={styles.actionButtons}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
                           <Text style={styles.actionBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                           <Text style={styles.actionBtnText}>🗑️</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               );
            }}
         />

         {/* Modal con el formulario de alta/edición */}
         <Modal visible={isFormOpen} animationType="slide">
            <ProductFormScreen
               initialProduct={selectedProduct}
               onClose={() => setIsFormOpen(false)}
            />
         </Modal>
      </View>
   );
};

const styles = StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: '#f8fafc',
   },
   topActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
   },
   productCount: {
      fontSize: 14,
      fontWeight: '600',
      color: '#475569',
   },
   newBtn: {
      backgroundColor: '#2563eb',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
   },
   newBtnText: {
      color: '#ffffff',
      fontWeight: 'bold',
      fontSize: 14,
   },
   listContent: {
      padding: 16,
      gap: 12,
   },
   card: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 12,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
      alignItems: 'center',
   },
   cardImage: {
      width: 76,
      height: 76,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
   },
   cardBody: {
      flex: 1,
      marginLeft: 12,
   },
   cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginRight: 8,
   },
   brand: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#2563eb',
      textTransform: 'uppercase',
   },
   code: {
      fontSize: 11,
      color: '#94a3b8',
      fontWeight: '600',
   },
   name: {
      fontSize: 15,
      fontWeight: '600',
      color: '#0f172a',
      marginVertical: 2,
   },
   price: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#16a34a',
   },
   stockBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      gap: 8,
   },
   stockBadge: {
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: 12,
   },
   stockAvailable: {
      backgroundColor: '#dcfce7',
   },
   stockEmpty: {
      backgroundColor: '#fee2e2',
   },
   stockText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#0f172a',
   },
   variantCount: {
      fontSize: 11,
      color: '#64748b',
   },
   actionButtons: {
      gap: 8,
   },
   actionBtn: {
      padding: 8,
      backgroundColor: '#f1f5f9',
      borderRadius: 6,
   },
   actionBtnText: {
      fontSize: 14,
   },
});
