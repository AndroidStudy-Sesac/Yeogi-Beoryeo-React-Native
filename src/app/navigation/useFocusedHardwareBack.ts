import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

export function useFocusedHardwareBack(handler?: () => boolean): void {
  useFocusEffect(
    useCallback(() => {
      if (!handler) return undefined;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handler,
      );
      return () => subscription.remove();
    }, [handler]),
  );
}
