import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

interface Waiter {
  id: string;
  name: string;
  selectedFloors: string[];
}

  const floors = [
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  'Beach Wing 1',
  'Beach Wing 2',
  'Private Front',
  'Private Sealed'
];

export default function ManageFloorAccessScreen() {
  const router = useRouter();

  const { width, height } = useWindowDimensions();

  const [waiterName, setWaiterName] = useState('');
  const [waiters, setWaiters] = useState<Waiter[]>([
    { id: '1', name: 'Tharaka Silva', selectedFloors: ['Ground Floor'] },
    { id: '2', name: 'Supun Perera', selectedFloors: ['1st Floor', '2nd Floor'] },
    { id: '3', name: 'Nimal Fernando', selectedFloors: ['Ground Floor', '1st Floor'] },
  ]);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);

  const isTablet = width >= 600;
  const isSmall = height < 700;

  const headerH = isTablet ? 160 : isSmall ? 110 : 140;
  const titleFs = isTablet ? 28 : isSmall ? 20 : 24;
  const backIconSize = isTablet ? 22 : isSmall ? 14 : 34;
  const backBtnSize = isTablet ? 40 : isSmall ? 30 : 34;
  const hPad = isTablet ? 24 : 16;

  const inputH = isTablet ? 58 : isSmall ? 46 : 52;
  const inputFs = isTablet ? 18 : isSmall ? 14 : 16;

  const sectionFs = isTablet ? 18 : isSmall ? 14 : 16;

  const manageBtnH = isTablet ? 34 : isSmall ? 28 : 32;
  const manageBtnFs = isTablet ? 14 : isSmall ? 11 : 12;

  const handleAddWaiter = () => {
    if (waiterName.trim()) {
      const newWaiter: Waiter = {
        id: Date.now().toString(),
        name: waiterName,
        selectedFloors: [],
      };
      setWaiters([...waiters, newWaiter]);
      setWaiterName('');
    }
  };

  const handleDeleteWaiter = (id: string) => {
    setWaiters(waiters.filter(w => w.id !== id));
  };

  const handleToggleFloor = (floor: string) => {
    if (!selectedWaiterId) return;

    setWaiters(waiters.map(w => {
      if (w.id === selectedWaiterId) {
        const isSelected = w.selectedFloors.includes(floor);
        return {
          ...w,
          selectedFloors: isSelected
            ? w.selectedFloors.filter(f => f !== floor)
            : [...w.selectedFloors, floor],
        };
      }
      return w;
    }));
  };

  const getSelectedWaiter = (): Waiter | undefined => {
    return waiters.find(w => w.id === selectedWaiterId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        backgroundColor="#FFFFFF"
        barStyle="dark-content"
      />

      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            height: headerH,
            paddingHorizontal: hPad,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            {
              width: backBtnSize,
              height: backBtnSize,
              borderRadius: backBtnSize / 2,
            },
          ]}
          onPress={() => router.back()}
        >
          <Image
            source={require('../../assets/icons/back.png')}
            style={{
              width: backIconSize,
              height: backIconSize,
            }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text
          style={[
            styles.headerTitle,
            { fontSize: titleFs },
          ]}
        >
          Manage Table Access
        </Text>

        <View style={{ width: backBtnSize }} />
      </View>

      {/* CONTENT */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: hPad,
            paddingBottom: 120,
          },
        ]}
      >
        {/* INPUT ROW */}
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Waiter Name"
            placeholderTextColor="#777"
            value={waiterName}
            onChangeText={setWaiterName}
            style={[
              styles.input,
              {
                height: inputH,
                fontSize: inputFs,
              },
            ]}
          />

          <TouchableOpacity
            style={[
              styles.addButton,
              { height: inputH },
            ]}
            activeOpacity={0.85}
            onPress={handleAddWaiter}
          >
            <Text style={styles.addIcon}>＋</Text>

            <Text
              style={[
                styles.addText,
                { fontSize: manageBtnFs + 1 },
              ]}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECTION */}
        <Text
          style={[
            styles.sectionTitle,
            {
              fontSize: sectionFs,
              marginTop: isTablet ? 28 : 22,
            },
          ]}
        >
          Manage Access
        </Text>

        <View style={styles.divider} />

        {/* LIST */}
        {waiters.map((waiter, index) => (
          <View
            key={waiter.id}
            style={styles.waiterRow}
          >
            {/* LEFT */}
            <View style={styles.waiterLeft}>
              <Text
                style={[
                  styles.waiterName,
                  {
                    fontSize: inputFs,
                  },
                ]}
              >
                {waiter.name}
              </Text>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteWaiter(waiter.id)}
              >
                <Ionicons name="trash-outline" size={isTablet ? 28 : 22} color="rgba(0,0,0,0.5)" />
              </TouchableOpacity>
            </View>

            {/* RIGHT */}
            <TouchableOpacity
              style={[
                styles.manageButton,
                {
                  height: manageBtnH,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => {
                setSelectedWaiterId(waiter.id);
                setShowFloorModal(true);
              }}
            >
              <Text
                style={[
                  styles.manageText,
                  {
                    fontSize: manageBtnFs,
                  },
                ]}
              >
                Manage
              </Text>

              <Text style={styles.manageArrow}>
                ▼
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* FLOOR SELECTION MODAL */}
      <Modal
        visible={showFloorModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select Floors for {getSelectedWaiter()?.name}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFloorModal(false);
                  setSelectedWaiterId(null);
                }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {floors.map((floor) => {
                const isSelected = getSelectedWaiter()?.selectedFloors.includes(floor) || false;
                return (
                  <TouchableOpacity
                    key={floor}
                    style={styles.floorOption}
                    onPress={() => handleToggleFloor(floor)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.floorText}>{floor}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowFloorModal(false);
                setSelectedWaiterId(null);
              }}
            >
              <Text style={styles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },

  header: {
    backgroundColor: '#002748',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
 
  },

  headerTitle: {
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    flex: 1,
  },

  content: {
    paddingTop: 20,
  },

  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  input: {
    width: '72%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 16,
    color: '#000',
    fontWeight: '300',
  },

  addButton: {
    width: '24%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addIcon: {
    fontSize: 18,
    color: '#000',
    marginRight: 4,
  },

  addText: {
    color: '#000',
    fontWeight: '500',
  },

  sectionTitle: {
    color: '#000',
    fontWeight: '500',
    marginBottom: 12,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: 10,
  },

  waiterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },

  waiterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  waiterName: {
    color: '#000',
    fontWeight: '400',
    marginRight: 12,
  },

  deleteButton: {
    padding: 4,
  },

  manageButton: {
    backgroundColor: '#D9D9D9',
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  manageText: {
    color: '#000',
    fontWeight: '400',
    marginRight: 4,
  },

  manageArrow: {
    fontSize: 10,
    color: '#000',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },

  modalClose: {
    fontSize: 24,
    fontWeight: '300',
    color: '#666',
  },

  modalScroll: {
    marginBottom: 20,
  },

  floorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkboxSelected: {
    backgroundColor: '#002748',
    borderColor: '#002748',
  },

  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },

  floorText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '400',
  },

  modalButton: {
    backgroundColor: '#002748',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },

  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});