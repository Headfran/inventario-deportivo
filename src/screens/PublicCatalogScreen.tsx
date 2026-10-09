import React from 'react';
import {
   View,
   Text,
   StyleSheet,
   TouchableOpacity,
   SafeAreaView
} from 'react-native';

interface PublicCatalogScreenProps {
   onOpenStaffAccess: () => void;
}

export const PublicCatalogScreen: React.FC<PublicCatalogScreenProps> = ({
   onOpenStaffAccess
}) => {
   return (
      <SafeAreaView style={styles.container}>
         {/* Encabezado con acceso discreto para el personal */}
         <View style={styles.header}>
            <View>
               <Text style={styles.brandTitle}>Tienda Deportiva</Text>
               <Text style={styles.brandSubtitle}>Catálogo de Prendas Disponibles</Text>
            </View>

            {/* Botón de acceso discreto al panel de personal */}
            <TouchableOpacity
               style={styles.staffAccessButton}
               onPress={onOpenStaffAccess}
               accessibilityLabel="Acceso de Personal"
            >
               <Text style={styles.staffAccessIcon}>🔒</Text>
            </TouchableOpacity>
         </View>

         {/* Contenido principal del catálogo público (Placeholder para la Fase 4/6) */}
         <View style={styles.content}>
            <Text style={styles.placeholderText}>
               👟 Catálogo Público en preparación...
            </Text>
            <Text style={styles.placeholderSubtext}>
               Aquí los clientes podrán consultar prendas, tallas y modelos disponibles sin ver precios mayoristas ni modificar stock.
            </Text>
         </View>
      </SafeAreaView>
   );
};

const styles = StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: '#f8fafc',
   },
   header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
   },
   brandTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#0f172a',
   },
   brandSubtitle: {
      fontSize: 12,
      color: '#64748b',
   },
   staffAccessButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#f1f5f9',
      justifyContent: 'center',
      alignItems: 'center',
   },
   staffAccessIcon: {
      fontSize: 16,
   },
   content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
   },
   placeholderText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#334155',
      textAlign: 'center',
      marginBottom: 8,
   },
   placeholderSubtext: {
      fontSize: 14,
      color: '#64748b',
      textAlign: 'center',
      maxWidth: 360,
      lineHeight: 20,
   },
});
