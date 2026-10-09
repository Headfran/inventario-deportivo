import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = '@user_access_pin';

export const pinService = {
  // Guardar un nuevo PIN de 4 dígitos
  async savePin(pin: string): Promise<void> {
    await AsyncStorage.setItem(PIN_KEY, pin);
  },

  // Obtener el PIN guardado
  async getPin(): Promise<string | null> {
    return await AsyncStorage.getItem(PIN_KEY);
  },

  // Verificar si el PIN ingresado coincide
  async verifyPin(inputPin: string): Promise<boolean> {
    const savedPin = await AsyncStorage.getItem(PIN_KEY);
    return savedPin === inputPin;
  },

  // Eliminar el PIN al cerrar sesión explícitamente
  async clearPin(): Promise<void> {
    await AsyncStorage.removeItem(PIN_KEY);
  },
};
