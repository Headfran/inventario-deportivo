import { Platform, Alert as RNAlert } from 'react-native';

/**
 * Muestra una alerta simple de información o error compatible con Web y Móvil.
 */
export const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    RNAlert.alert(title, message);
  }
};

/**
 * Muestra un cuadro de confirmación (Aceptar / Cancelar) compatible con Web y Móvil.
 */
export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    RNAlert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: onCancel },
        { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
      ]
    );
  }
};
