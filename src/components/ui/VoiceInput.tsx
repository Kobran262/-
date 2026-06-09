import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
  Easing,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Rect, Path, Line } from 'react-native-svg';
import {
  prepareAudioSession,
  requestAudioPermission,
  transcribeRecording,
} from '@/src/services/voice/recorder';
import { parseVoiceCommand } from '@/src/services/voice/parser';
import type { VoiceCommand } from '@/src/services/voice/parser';

export function MicIcon({ size = 20, color = '#C8A96E' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="9"
        y="2"
        width="6"
        height="11"
        rx="3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 10a7 7 0 0 0 14 0"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="9" y1="21" x2="15" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'confirming';

interface VoiceInputProps {
  onCommand: (cmd: VoiceCommand) => void;
  disabled?: boolean;
  renderTrigger?: (
    onPress: () => void,
    state: VoiceState,
    animatedStyle: object
  ) => ReactNode;
}

export function VoiceInput({ onCommand, disabled, renderTrigger }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [command, setCommand] = useState<VoiceCommand | null>(null);
  const pulse = useSharedValue(1);
  const opacity = useSharedValue(1);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const triggerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: opacity.value,
  }));

  const beginTranscribing = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pulse.value = withTiming(1, { duration: 200 });
    setState('transcribing');
  };

  const startRecording = async () => {
    if (state !== 'idle' || disabled) return;

    const granted = await requestAudioPermission();
    if (!granted) {
      Alert.alert('Нет доступа к микрофону');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('recording');
    pulse.value = withRepeat(withTiming(1.3, { duration: 600, easing: Easing.ease }), -1, true);

    try {
      await prepareAudioSession();
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record({ forDuration: 8 });
      await new Promise((resolve) => setTimeout(resolve, 8200));
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }

      const uri = audioRecorder.uri;
      if (!uri) throw new Error('Не удалось записать аудио');

      opacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(beginTranscribing)();
        opacity.value = withTiming(1, { duration: 200 });
      });

      const result = await transcribeRecording(uri);
      const cmd = await parseVoiceCommand(result.text);
      setCommand(cmd);
      setState('confirming');
    } catch (e) {
      Alert.alert('Ошибка записи', e instanceof Error ? e.message : String(e));
      setState('idle');
      pulse.value = 1;
      opacity.value = 1;
    }
  };

  const confirmCommand = () => {
    if (command) onCommand(command);
    setState('idle');
    setCommand(null);
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(startRecording, state, triggerAnimatedStyle)
      ) : (
        <Pressable
          onPress={startRecording}
          disabled={disabled || state !== 'idle'}
          className={`w-[44px] h-[44px] rounded-full border items-center justify-center ${
            state !== 'idle' ? 'border-gold bg-gold/10' : 'border-border bg-surface'
          }`}
        >
          {state === 'transcribing' ? (
            <ActivityIndicator size="small" color="#C8A96E" />
          ) : state === 'recording' ? (
            <Animated.View style={pulseStyle}>
              <Text className="text-danger">⏺</Text>
            </Animated.View>
          ) : (
            <MicIcon size={20} color={state !== 'idle' ? '#C8A96E' : '#888'} />
          )}
        </Pressable>
      )}

      <Modal visible={state === 'confirming'} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/70">
          <View className="bg-background rounded-t-3xl px-5 pt-4 pb-8">
            <View className="w-10 h-1 rounded-full bg-[#333] self-center mb-4" />

            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-base font-medium">Проверьте данные</Text>
              <View className="flex-row items-center gap-1.5">
                <View
                  className={`w-2 h-2 rounded-full ${
                    (command?.confidence ?? 0) > 0.7
                      ? 'bg-success'
                      : (command?.confidence ?? 0) > 0.4
                        ? 'bg-amber-400'
                        : 'bg-danger'
                  }`}
                />
                <Text className="text-[11px] text-[#555]">
                  {Math.round((command?.confidence ?? 0) * 100)}% уверенность
                </Text>
              </View>
            </View>

            <View className="bg-surface border border-border rounded-xl px-3.5 py-2.5 mb-4">
              <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1">Распознано</Text>
              <Text className="text-foreground text-sm font-mono">«{command?.raw}»</Text>
            </View>

            <View className="gap-2 mb-4">
              <View>
                <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 ml-0.5">
                  Операция
                </Text>
                <View className="flex-row gap-2">
                  {(['shipment', 'receipt', 'transfer'] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setCommand((prev) => (prev ? { ...prev, type: t } : prev))}
                      className={`flex-1 py-2 rounded-lg border items-center ${
                        command?.type === t
                          ? 'border-gold bg-gold/10'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <Text className={`text-xs ${command?.type === t ? 'text-gold' : 'text-[#888]'}`}>
                        {t === 'shipment' ? 'Отгрузка' : t === 'receipt' ? 'Приёмка' : 'Передача'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 ml-0.5">
                  Товар
                </Text>
                <View
                  className="bg-surface border border-border rounded-xl px-3.5"
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <TextInput
                    className="text-foreground text-sm"
                    value={command?.productName ?? ''}
                    onChangeText={(v) =>
                      setCommand((prev) => (prev ? { ...prev, productName: v } : prev))
                    }
                    placeholder="Название товара или SKU"
                    placeholderTextColor="#444"
                  />
                </View>
                {command?.sku && (
                  <Text className="text-[10px] text-gold ml-1 mt-0.5">{command.sku}</Text>
                )}
              </View>

              <View className="flex-row gap-2">
                <View className="flex-[2]">
                  <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 ml-0.5">
                    Количество *
                  </Text>
                  <View
                    className="bg-surface border border-border rounded-xl px-3.5"
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <TextInput
                      className="text-foreground text-sm"
                      value={command?.qty != null ? String(command.qty) : ''}
                      onChangeText={(v) => {
                        const n = parseFloat(v);
                        setCommand((prev) =>
                          prev ? { ...prev, qty: Number.isNaN(n) ? undefined : n } : prev
                        );
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#444"
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 ml-0.5">
                    Ед.
                  </Text>
                  <View className="flex-row gap-1">
                    {(['г', 'кг', 'шт', 'уп'] as const).map((u) => (
                      <Pressable
                        key={u}
                        onPress={() => setCommand((prev) => (prev ? { ...prev, unit: u } : prev))}
                        className={`flex-1 py-2.5 rounded-lg border items-center ${
                          command?.unit === u
                            ? 'border-gold bg-gold/10'
                            : 'border-border bg-surface'
                        }`}
                      >
                        <Text
                          className={`text-[11px] ${command?.unit === u ? 'text-gold' : 'text-[#888]'}`}
                        >
                          {u}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 ml-0.5">
                  Дата
                </Text>
                <View className="flex-row gap-2">
                  {[
                    { label: 'Сегодня', offset: 0 },
                    { label: 'Вчера', offset: -1 },
                    { label: 'Позавчера', offset: -2 },
                  ].map(({ label, offset }) => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    d.setHours(12, 0, 0, 0);
                    const ts = d.getTime();
                    const isSelected =
                      command?.date != null &&
                      new Date(command.date).toDateString() === d.toDateString();
                    return (
                      <Pressable
                        key={label}
                        onPress={() => setCommand((prev) => (prev ? { ...prev, date: ts } : prev))}
                        className={`flex-1 py-2 rounded-lg border items-center ${
                          isSelected ? 'border-gold bg-gold/10' : 'border-border bg-surface'
                        }`}
                      >
                        <Text className={`text-xs ${isSelected ? 'text-gold' : 'text-[#888]'}`}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {(command?.confidence ?? 0) < 0.4 && (
              <View className="bg-danger/10 border border-danger/30 rounded-xl px-3 py-2 mb-3 flex-row gap-2 items-center">
                <Text className="text-danger">⚠</Text>
                <Text className="text-danger text-xs flex-1">
                  Низкая уверенность — данные могли быть распознаны неверно
                </Text>
              </View>
            )}

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setState('idle');
                  setCommand(null);
                }}
                className="flex-1 bg-surface border border-border rounded-xl py-3.5 items-center"
              >
                <Text className="text-[#888]">Отмена</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!command?.qty || command.qty <= 0) {
                    Alert.alert('Укажите количество');
                    return;
                  }
                  confirmCommand();
                }}
                className="flex-[2] bg-gold rounded-xl py-3.5 items-center"
              >
                <Text className="text-background font-medium">Создать акт →</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
