import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface TabBarIconProps {
  name: string;
  size: number;
  color: string;
}

export function TabBarIcon({ name, size, color }: TabBarIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}