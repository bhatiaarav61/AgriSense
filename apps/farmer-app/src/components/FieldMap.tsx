/**
 * Field Map Component
 * Interactive map for field boundaries, GPS tagging, and location visualization
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polygon, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import * as Location from 'expo-location';
import { Field } from '@/services/database';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FieldMapProps {
  fields: Field[];
  selectedFieldId?: string;
  onSelectField: (field: Field | null) => void;
  onAddField: (coordinates: Array<{ lat: number; lng: number }>) => void;
  editable?: boolean;
  showCurrentLocation?: boolean;
  regionId?: string;
}

export const FieldMap: React.FC<FieldMapProps> = ({
  fields,
  selectedFieldId,
  onSelectField,
  onAddField,
  editable = false,
  showCurrentLocation = true,
  regionId,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [mapRef, setMapRef] = useRef<MapView>(null);
  const [region, setRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }>({
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addingField, setAddingField] = useState(false);
  const [newFieldPoints, setNewFieldPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [showFieldList, setShowFieldList] = useState(false);

  // Get user location on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const coords = { lat: location.coords.latitude, lng: location.coords.longitude };
          setCurrentLocation(coords);
          setRegion(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }));
        }
      } catch (err) {
        console.warn('Location not available:', err);
      }
    };
    getLocation();
  }, []);

  // Fit map to show all fields
  useEffect(() => {
    if (fields.length > 0 && mapRef.current) {
      const coords = fields.flatMap(f => {
        if (f.boundary_points) {
          try {
            return JSON.parse(f.boundary_points);
          } catch {
            return [{ lat: f.latitude, lng: f.longitude }];
          }
        }
        return [{ lat: f.latitude, lng: f.longitude }];
      });

      if (coords.length > 0) {
        const lats = coords.map(c => c.lat);
        const lngs = coords.map(c => c.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const center = {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
        };

        const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
        const longitudeDelta = Math.max((maxLng - minLng) * 1.5, 0.01);

        mapRef.current.animateToRegion({
          ...center,
          latitudeDelta: latDelta,
          longitudeDelta: longitudeDelta,
        }, 500);
      }
    }
  }, [fields]);

  const handleMapPress = useCallback((event: any) => {
    if (!editable || !addingField) return;

    const { latitude, longitude } = event.nativeEvent.coordinate;
    setNewFieldPoints(prev => [...prev, { lat: latitude, lng: longitude }]);
  }, [editable, addingField]);

  const handleMarkerPress = useCallback((field: Field) => {
    onSelectField(field);
  }, [onSelectField]);

  const startAddingField = useCallback(() => {
    if (!editable) return;
    setAddingField(true);
    setNewFieldPoints([]);
  }, [editable]);

  const finishAddingField = useCallback(() => {
    if (newFieldPoints.length < 3) {
      Alert.alert('Need More Points', 'Please add at least 3 points to define a field boundary');
      return;
    }
    onAddField(newFieldPoints);
    setAddingField(false);
    setNewFieldPoints([]);
  }, [newFieldPoints, onAddField]);

  const cancelAddingField = useCallback(() => {
    setAddingField(false);
    setNewFieldPoints([]);
  }, []);

  const undoLastPoint = useCallback(() => {
    setNewFieldPoints(prev => prev.slice(0, -1));
  }, []);

  const handleCurrentLocation = useCallback(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }, [currentLocation]);

  const getFieldColor = (field: Field) => {
    if (field.id === selectedFieldId) return theme.primary;
    // Color by crop
    const cropColors: Record<string, string> = {
      rice: '#10B981',
      wheat: '#F59E0B',
      maize: '#8B5CF6',
      cotton: '#EC4899',
      soybean: '#06B6D4',
    };
    return cropColors[field.crop_id] || theme.primary;
  };

  const renderFieldPolygon = (field: Field) => {
    if (!field.boundary_points) return null;

    try {
      const coordinates = JSON.parse(field.boundary_points);
      const isSelected = field.id === selectedFieldId;
      const color = getFieldColor(field);

      return (
        <Polygon
          key={field.id}
          coordinates={coordinates}
          strokeColor={color}
          strokeWidth={isSelected ? 3 : 2}
          fillColor={`${color}${isSelected ? '40' : '20'}`}
          onPress={() => handleMarkerPress(field)}
        />
      );
    } catch {
      return null;
    }
  };

  const renderNewFieldPolygon = () => {
    if (newFieldPoints.length < 3) return null;

    return (
      <Polygon
        coordinates={newFieldPoints}
        strokeColor={theme.primary}
        strokeWidth={2}
        strokeDashPattern={[10, 5]}
        fillColor={`${theme.primary}20`}
      />
    );
  };

  const renderNewFieldMarkers = () => {
    return newFieldPoints.map((point, index) => (
      <Marker
        key={`new_${index}`}
        coordinate={point}
        anchor={{ x: 0.5, y: 1 }}
      >
        <View style={styles.newFieldMarker}>
          <View style={styles.newFieldMarkerDot} />
          <Text style={styles.newFieldMarkerNumber}>{index + 1}</Text>
        </View>
      </Marker>
    ));
  };

  const renderFieldMarkers = () => {
    return fields.map(field => (
      <Marker
        key={field.id}
        coordinate={{ latitude: field.latitude, longitude: field.longitude }}
        anchor={{ x: 0.5, y: 1 }}
        onPress={() => handleMarkerPress(field)}
      >
        <View
          style={[
            styles.fieldMarker,
            field.id === selectedFieldId && styles.fieldMarkerSelected,
            { backgroundColor: getFieldColor(field) },
          ]}
        >
          <Ionicons name="leaf" size={18} color="#fff" />
        </View>
      </Marker>
    ));
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={setMapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsUserLocation={showCurrentLocation}
        showsMyLocationButton={true}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        mapType="satellite"
      >
        {/* Existing field polygons */}
        {fields.map(renderFieldPolygon)}

        {/* New field being drawn */}
        {renderNewFieldPolygon()}
        {renderNewFieldMarkers()}

        {/* Field markers */}
        {renderFieldMarkers()}

        {/* Current location marker */}
        {currentLocation && showCurrentLocation && (
          <Marker
            coordinate={currentLocation}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.currentLocationMarker}>
              <View style={styles.currentLocationPulse} />
              <View style={styles.currentLocationDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Adding field mode toolbar */}
      {addingField && (
        <View style={styles.addingToolbar}>
          <View style={styles.addingToolbarContent}>
            <Text style={[styles.addingToolbarText, { color: theme.textPrimary }]}>
              Tap to add boundary points ({newFieldPoints.length})
            </Text>
            <View style={styles.addingToolbarActions}>
              {newFieldPoints.length > 0 && (
                <TouchableOpacity style={styles.toolbarButton} onPress={undoLastPoint}>
                  <Ionicons name="undo" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.toolbarButton, styles.toolbarButtonDanger]} onPress={cancelAddingField}>
                <Ionicons name="close" size={20} color={theme.error} />
              </TouchableOpacity>
              {newFieldPoints.length >= 3 && (
                <TouchableOpacity style={[styles.toolbarButton, styles.toolbarButtonPrimary]} onPress={finishAddingField}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        {editable && !addingField && (
          <TouchableOpacity style={styles.fab} onPress={startAddingField}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.fabSecondary} onPress={handleCurrentLocation}>
          <Ionicons name="locate" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.fabSecondary} onPress={() => setShowFieldList(true)}>
          <Ionicons name="list" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Selected field info card */}
      {selectedFieldId && (
        <FieldInfoCard
          field={fields.find(f => f.id === selectedFieldId)!}
          onClose={() => onSelectField(null)}
          theme={theme}
        />
      )}

      {/* Field list modal */}
      <Modal visible={showFieldList} animationType="slide" transparent onRequestClose={() => setShowFieldList(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Your Fields
              </Text>
              <TouchableOpacity onPress={() => setShowFieldList(false)}>
                <Ionicons name="close" size={28} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {fields.length === 0 ? (
                <View style={styles.emptyFields}>
                  <Ionicons name="map-outline" size={48} color={theme.textTertiary} />
                  <Text style={[styles.emptyFieldsText, { color: theme.textSecondary }]}>
                    No fields added yet
                  </Text>
                  {editable && (
                    <TouchableOpacity style={styles.emptyFieldsButton} onPress={startAddingField}>
                      <Text style={styles.emptyFieldsButtonText}>Add First Field</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                fields.map(field => (
                  <TouchableOpacity
                    key={field.id}
                    style={[
                      styles.fieldListItem,
                      field.id === selectedFieldId && styles.fieldListItemSelected,
                    ]}
                    onPress={() => {
                      handleMarkerPress(field);
                      setShowFieldList(false);
                    }}
                  >
                    <View
                      style={[
                        styles.fieldListColor,
                        { backgroundColor: getFieldColor(field) },
                      ]}
                    />
                    <View style={styles.fieldListInfo}>
                      <Text style={[styles.fieldListName, { color: theme.textPrimary }]}>
                        {field.name}
                      </Text>
                      <Text style={[styles.fieldListDetails, { color: theme.textSecondary }]}>
                        {field.crop_name || field.crop_id} • {field.area_hectares} ha
                      </Text>
                    </View>
                    {field.id === selectedFieldId && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Field Info Card Component
interface FieldInfoCardProps {
  field: Field;
  onClose: () => void;
  theme: typeof Colors.light;
}

const FieldInfoCard: React.FC<FieldInfoCardProps> = ({ field, onClose, theme }) => {
  return (
    <View style={styles.infoCard}>
      <TouchableOpacity style={styles.infoCardClose} onPress={onClose}>
        <Ionicons name="chevron-down" size={24} color={theme.textTertiary} />
      </TouchableOpacity>

      <View style={styles.infoCardHeader}>
        <View
          style={[
            styles.infoCardIcon,
            { backgroundColor: `${getFieldColorByCrop(field.crop_id)}20` },
          ]}
        >
          <Ionicons name="leaf" size={24} color={getFieldColorByCrop(field.crop_id)} />
        </View>
        <View style={styles.infoCardTitleArea}>
          <Text style={[styles.infoCardName, { color: theme.textPrimary }]}>
            {field.name}
          </Text>
          <Text style={[styles.infoCardCrop, { color: theme.textSecondary }]}>
            {field.crop_name || field.crop_id} • {field.area_hectares} ha
          </Text>
        </View>
      </View>

      <View style={styles.infoCardDetails}>
        {field.planting_date && (
          <InfoRow
            icon="calendar"
            label="Planted"
            value={formatDate(field.planting_date)}
            theme={theme}
          />
        )}
        {field.expected_harvest_date && (
          <InfoRow
            icon="harvest"
            label="Harvest"
            value={formatDate(field.expected_harvest_date)}
            theme={theme}
          />
        )}
        {field.irrigation_type && (
          <InfoRow
            icon="water"
            label="Irrigation"
            value={field.irrigation_type.replace('_', ' ')}
            theme={theme}
          />
        )}
        {field.soil_type && (
          <InfoRow
            icon="earth"
            label="Soil"
            value={field.soil_type}
            theme={theme}
          />
        )}
      </View>

      <View style={styles.infoCardActions}>
        <TouchableOpacity style={styles.infoCardAction}>
          <Ionicons name="navigate" size={20} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.infoCardAction}>
          <Ionicons name="camera" size={20} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.infoCardAction}>
          <Ionicons name="analytics" size={20} color={theme.primary} />
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Analytics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function getFieldColorByCrop(cropId: string): string {
  const cropColors: Record<string, string> = {
    rice: '#10B981',
    wheat: '#F59E0B',
    maize: '#8B5CF6',
    cotton: '#EC4899',
    soybean: '#06B6D4',
  };
  return cropColors[cropId] || '#10B981';
}

const InfoRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  theme: typeof Colors.light;
}> = ({ icon, label, value, theme }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={18} color={theme.textTertiary} />
    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{value}</Text>
  </View>
);

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  addingToolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  addingToolbarContent: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addingToolbarText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  addingToolbarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarButtonPrimary: {
    backgroundColor: '#10B981',
  },
  toolbarButtonDanger: {},

  bottomControls: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    flexDirection: 'column',
    gap: 12,
    zIndex: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Info Card
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 15,
  },
  infoCardClose: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    padding: 8,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  infoCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardTitleArea: { flex: 1 },
  infoCardName: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoCardCrop: {
    fontSize: 13,
    marginTop: 2,
  },
  infoCardDetails: {
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    minWidth: 70,
  },
  infoValue: {
    fontSize: 13,
    flex: 1,
  },
  infoCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },

  // Field List Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
    padding: 16,
  },
  emptyFields: {
    alignItems: 'center',
    padding: 40,
  },
  emptyFieldsText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyFieldsButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 25,
  },
  emptyFieldsButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  fieldListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldListItemSelected: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  fieldListColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fieldListInfo: { flex: 1 },
  fieldListName: {
    fontSize: 15,
    fontWeight: '600',
  },
  fieldListDetails: {
    fontSize: 13,
    marginTop: 2,
  },

  // Markers
  fieldMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  fieldMarkerSelected: {
    transform: [{ scale: 1.2 }],
    borderWidth: 3,
  },
  newFieldMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFieldMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  newFieldMarkerNumber: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  currentLocationMarker: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
  },
  currentLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default FieldMap;