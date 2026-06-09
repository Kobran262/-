import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, Alert, ActivityIndicator } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
} from 'expo-audio';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
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

interface VoiceInputProps {
  onCommand: (cmd: VoiceCommand) => void;
  disabled?: boolean;
  renderTrigger?: (onPress: () => void, isActive: boolean) => ReactNode;
}

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'confirming';

export function VoiceInput({ onCommand, disabled, renderTrigger }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [command, setCommand] = useState<VoiceCommand | null>(null);
  const pulse = useSharedValue(1);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const startRecording = async () => {
    if (state !== 'idle' || disabled) return;

    const granted = await requestAudioPermission();
    if (!granted) {
      Alert.alert('Нет доступа к микрофону');
      return;
    }

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

      const result = await transcribeRecording(uri, () => {
        setState('transcribing');
        pulse.value = 1;
      });
      const cmd = await parseVoiceCommand(result.text);
      setCommand(cmd);
      setState('confirming');
    } catch (e) {
      Alert.alert('Ошибка записи', e instanceof Error ? e.message : String(e));
      setState('idle');
      pulse.value = 1;
    }
  };

  const confirmCommand = () => {
    if (command) onCommand(command);
    setState('idle');
    setCommand(null);
  };

  const isActive = state === 'recording' || state === 'transcribing';

  return (
    <>
      {renderTrigger ? (
        renderTrigger(startRecording, isActive)
      ) : (
        <Pressable
          onPress={startRecording}
          disabled={disabled || state !== 'idle'}
          className={`w-[44px] h-[44px] rounded-full border items-center justify-center ${
            isActive ? 'border-gold bg-gold/10' : 'border-border bg-surface'
          }`}
        >
          {state === 'transcribing' ? (
            <ActivityIndicator size="small" color="#C8A96E" />
          ) : state === 'recording' ? (
            <Animated.View style={pulseStyle}>
              <Text className="text-danger">⏺</Text>
            </Animated.View>
          ) : (
            <MicIcon size={20} color={isActive ? '#C8A96E' : '#888'} />
          )}
        </Pressable>
      )}

      <Modal visible={state === 'confirming'} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-background rounded-t-2xl p-5">
            <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Распознано</Text>
            <Text className="text-foreground text-sm mb-1 font-mono">«{command?.raw}»</Text>
            <View className="bg-surface border border-border rounded-xl p-3 mb-4">
              <Text className="text-foreground text-sm">{command?.suggestion}</Text>
              <View className="flex-row items-center mt-2">
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${
                    (command?.confidence ?? 0) > 0.7
                      ? 'bg-success'
                      : (command?.confidence ?? 0) > 0.4
                        ? 'bg-amber-400'
                        : 'bg-danger'
                  }`}
                />
                <Text className="text-[11px] text-[#555]">
                  Уверенность: {Math.round((command?.confidence ?? 0) * 100)}%
                </Text>
              </View>
            </View>
            {(command?.confidence ?? 0) < 0.4 && (
              <Text className="text-danger text-xs mb-3">
                ⚠ Низкая уверенность — проверьте данные перед созданием
              </Text>
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
                onPress={confirmCommand}
                className="flex-[2] bg-gold rounded-xl py-3.5 items-center"
              >
                <Text className="text-background font-medium">Применить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
