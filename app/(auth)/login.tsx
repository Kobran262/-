import { useState } from 'react';
import { View, Text, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '@/src/store/authStore';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import type { User } from '@/src/types';

export default function LoginScreen() {
  const { allUsers, loginWithPin, loginWithBiometric, biometricEnabled, setBiometric } =
    useAuthStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinPress = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4 && selectedUser) {
      submitPin(selectedUser.id, newPin);
    }
  };

  const submitPin = async (userId: string, pinCode: string) => {
    setLoading(true);
    const ok = await loginWithPin(userId, pinCode);
    setLoading(false);
    if (!ok) {
      Alert.alert('Ошибка', 'Неверный PIN-код');
      setPin('');
    }
  };

  const handleBiometric = async () => {
    setLoading(true);
    const ok = await loginWithBiometric();
    setLoading(false);
    if (!ok) Alert.alert('Ошибка', 'Биометрия недоступна');
  };

  const enableBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) {
      Alert.alert('Недоступно', 'Биометрия не настроена на устройстве');
      return;
    }
    await setBiometric(true);
    Alert.alert('Готово', 'Face ID / Touch ID включён');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
      <View className="flex-1 px-6 justify-center">
        <Text className="text-gold text-3xl font-bold text-center mb-1">Srecha WMS</Text>
        <Text className="text-foreground/60 text-center mb-8">Складской учёт DOO «Srecha»</Text>

        {!selectedUser ? (
          <>
            <Text className="text-foreground text-lg mb-4">Выберите пользователя</Text>
            {allUsers.map((user) => (
              <Pressable key={user.id} onPress={() => setSelectedUser(user)}>
                <Card className="mb-3 flex-row justify-between items-center">
                  <View>
                    <Text className="text-foreground text-base font-medium">{user.name}</Text>
                    <Text className="text-foreground/50 text-sm">{user.role} · {user.warehouse_default}</Text>
                  </View>
                  <Text className="text-gold text-xl">→</Text>
                </Card>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Pressable onPress={() => { setSelectedUser(null); setPin(''); }}>
              <Text className="text-gold mb-4">← {selectedUser.name}</Text>
            </Pressable>
            <Text className="text-foreground text-center text-lg mb-6">Введите PIN-код</Text>
            <View className="flex-row justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-gold' : 'bg-card border border-white/20'}`}
                />
              ))}
            </View>
            <View className="flex-row flex-wrap justify-center gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => (
                <Pressable
                  key={key || 'empty'}
                  className={`w-20 h-16 items-center justify-center rounded-2xl ${key ? 'bg-card active:bg-card/80' : ''}`}
                  onPress={() => {
                    if (key === '⌫') setPin((p) => p.slice(0, -1));
                    else if (key) handlePinPress(key);
                  }}
                  disabled={!key || loading}
                >
                  <Text className="text-foreground text-2xl">{key}</Text>
                </Pressable>
              ))}
            </View>
            {biometricEnabled ? (
              <Button title="Face ID / Touch ID" variant="secondary" className="mt-6" onPress={handleBiometric} loading={loading} />
            ) : (
              <Button title="Включить биометрию" variant="ghost" className="mt-6" onPress={enableBiometric} />
            )}
          </>
        )}
      </View>
      <Text className="text-foreground/30 text-center pb-4 text-xs">PIN по умолчанию: 1234</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
