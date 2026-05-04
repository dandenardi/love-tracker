import React, { useState } from 'react';
import { Platform, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  show: boolean;
  onClose: () => void;
}

export function DateTimePickerWrapper({ value, onChange, show, onClose }: Props) {
  const [androidMode, setAndroidMode] = useState<'date' | 'time'>('date');

  if (!show) return null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <input
          type="datetime-local"
          value={value.toISOString().slice(0, 16)}
          onChange={(e) => {
            onChange(new Date(e.target.value));
            onClose();
          }}
          style={{
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '16px',
            width: '100%',
          }}
        />
        <TouchableOpacity onPress={onClose} style={styles.webCloseBtn}>
          <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode={androidMode}
        display="default"
        onChange={(_, selectedDate) => {
          if (!selectedDate) {
            onClose();
            return;
          }
          
          if (androidMode === 'date') {
            // Keep the time from the original value
            const nextDate = new Date(selectedDate);
            nextDate.setHours(value.getHours());
            nextDate.setMinutes(value.getMinutes());
            onChange(nextDate);
            setAndroidMode('time'); // Switch to time picker
          } else {
            // Keep the date from the value (which was just updated)
            const nextDate = new Date(value);
            nextDate.setHours(selectedDate.getHours());
            nextDate.setMinutes(selectedDate.getMinutes());
            onChange(nextDate);
            setAndroidMode('date'); // Reset for next time
            onClose();
          }
        }}
      />
    );
  }

  // iOS
  return (
    <DateTimePicker
      value={value}
      mode="datetime"
      display="spinner"
      onChange={(_, date) => {
        if (date) onChange(date);
      }}
    />
  );
}

const styles = StyleSheet.create({
  webContainer: {
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    marginTop: 10,
    gap: 10,
  },
  webCloseBtn: {
    alignItems: 'center',
    padding: 8,
  }
});
