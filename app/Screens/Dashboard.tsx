import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      
      {/* ── HEADER SECTION ────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>2026/06/12 • All Location</Text>
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Overview</Text>
          <Ionicons name="chevron-down" size={16} color="black" />
        </TouchableOpacity>
      </View>

      {/* ── CARD 1: MAIN STATS GRID ───────────────────────────────── */}
      <View style={styles.mainCard}>
        <View style={styles.statsGrid}>
          {/* Sales Volume */}
          <View style={[styles.statBox, { backgroundColor: '#E6F0FA' }]}>
            <View style={styles.statHeader}>
              <View style={[styles.iconBg, { backgroundColor: '#075EA7' }]}>
                <Ionicons name="trending-up" size={18} color="white" />
              </View>
            </View>
            <Text style={styles.statLabel}>Sales Volume</Text>
            <Text style={styles.statValue}>456,784.00</Text>
            <Text style={[styles.statSubText, { color: '#22C55E' }]}>+14.2% from Yesterday</Text>
          </View>

          {/* Total Orders */}
          <View style={[styles.statBox, { backgroundColor: '#F0FDF4' }]}>
            <View style={styles.statHeader}>
              <View style={[styles.iconBg, { backgroundColor: '#15803D' }]}>
                <Ionicons name="cart" size={18} color="white" />
              </View>
            </View>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.statValue}>734</Text>
            <Text style={[styles.statSubText, { color: '#22C55E' }]}>+22 new today</Text>
          </View>

          {/* Discount Volume */}
          <View style={[styles.statBox, { backgroundColor: '#FEF2F2' }]}>
            <View style={styles.statHeader}>
              <View style={[styles.iconBg, { backgroundColor: '#B91C1C' }]}>
                <Ionicons name="gift" size={18} color="white" />
              </View>
            </View>
            <Text style={styles.statLabel}>Discount Volume</Text>
            <Text style={styles.statValue}>46,784.00</Text>
            <Text style={styles.statSubText}>10.2% of gross sales</Text>
          </View>

          {/* Gross Sales */}
          <View style={[styles.statBox, { backgroundColor: '#FFFBEB' }]}>
            <View style={styles.statHeader}>
              <View style={[styles.iconBg, { backgroundColor: '#B45309' }]}>
                <Ionicons name="cash" size={18} color="white" />
              </View>
            </View>
            <Text style={styles.statLabel}>Gross Sales</Text>
            <Text style={styles.statValue}>452,217.00</Text>
            <Text style={styles.statSubText}>Billing - STANDARD</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreButtonText}>More</Text>
          <Ionicons name="arrow-forward" size={14} color="#075EA7" />
        </TouchableOpacity>
      </View>

      {/* ── CARD 2: SALES DISTRIBUTION BY ORDER MODES ─────────────── */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>Sales Distribution By Order Modes</Text>
        
        {/* Mock Chart Area */}
        <View style={styles.chartContainer}>
          <View style={styles.mockPieChart}>
            {/* Simple CSS segments visualization */}
            <View style={[styles.pieSegment, { backgroundColor: '#2E2855', transform: [{ rotate: '0deg' }] }]} />
            <View style={[styles.pieSegment, { backgroundColor: '#8AB4FF', transform: [{ rotate: '120deg' }] }]} />
            <View style={[styles.pieSegment, { backgroundColor: '#703DDE', transform: [{ rotate: '220deg' }] }]} />
            <View style={[styles.pieSegment, { backgroundColor: '#3F96D4', transform: [{ rotate: '300deg' }] }]} />
            <View style={styles.pieInnerCircle} />
          </View>
        </View>

        {/* Legend / Indicators */}
        <View style={styles.legendGrid}>
          <View style={styles.legendItem}><View style={[styles.bullet, { backgroundColor: '#2E2855' }]} /><Text style={styles.legendText}>Dining (35%)</Text></View>
          <View style={styles.legendItem}><View style={[styles.bullet, { backgroundColor: '#8AB4FF' }]} /><Text style={styles.legendText}>Take Away (10%)</Text></View>
          <View style={styles.legendItem}><View style={[styles.bullet, { backgroundColor: '#703DDE' }]} /><Text style={styles.legendText}>Pick Up (25%)</Text></View>
          <View style={styles.legendItem}><View style={[styles.bullet, { backgroundColor: '#3F96D4' }]} /><Text style={styles.legendText}>Delivery (20%)</Text></View>
        </View>
      </View>

      {/* ── CARD 3: TOP PERFORMANCE (BAR CHART) ────────────────────── */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>Top Performance</Text>
        
        <View style={styles.barChartContainer}>
          {/* Bar 1 */}
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>Crimson Chopsticks</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.actualBar, { width: '85%', backgroundColor: '#075EA7' }]} />
              <Text style={styles.barValue}>709</Text>
            </View>
          </View>

          {/* Bar 2 */}
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>Basil & Barrel</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.actualBar, { width: '75%', backgroundColor: '#3B82F6' }]} />
              <Text style={styles.barValue}>620</Text>
            </View>
          </View>

          {/* Bar 3 */}
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>The Olive Grove</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.actualBar, { width: '68%', backgroundColor: '#60A5FA' }]} />
              <Text style={styles.barValue}>583</Text>
            </View>
          </View>

          {/* Bar 4 */}
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>The Golden Wok</Text>
            <View style={styles.barWrapper}>
              <View style={[styles.actualBar, { width: '50%', backgroundColor: '#93C5FD' }]} />
              <Text style={styles.barValue}>425</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── CARD 4: PAYMENT TYPE BREAKDOWN ─────────────────────────── */}
      <View style={styles.mainCard}>
        <Text style={styles.cardTitle}>Payment Type</Text>
        
        <View style={styles.paymentGrid}>
          <View style={styles.paymentBadge}><View style={[styles.square, { backgroundColor: '#006BD6' }]} /><Text style={styles.paymentText}>VISA CARD</Text></View>
          <View style={styles.paymentBadge}><View style={[styles.square, { backgroundColor: '#537FF1' }]} /><Text style={styles.paymentText}>MASTER CARD</Text></View>
          <View style={styles.paymentBadge}><View style={[styles.square, { backgroundColor: '#FF6F5A' }]} /><Text style={styles.paymentText}>AMEX CARD</Text></View>
          <View style={styles.paymentBadge}><View style={[styles.square, { backgroundColor: '#3CC3DF' }]} /><Text style={styles.paymentText}>CASH</Text></View>
          <View style={styles.paymentBadge}><View style={[styles.square, { backgroundColor: '#FF1301' }]} /><Text style={styles.paymentText}>CREDIT</Text></View>
          <View style={styles.paymentBadge}><View style={[styles.square, { backgroundColor: '#5A4DC0' }]} /><Text style={styles.paymentText}>GIFT VOUCHER</Text></View>
        </View>
      </View>

    </ScrollView>
  );
}

// ── 🛠️ RESPONSIVE FLEXBOX STYLES ──────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // මදක් අළු පැහැති නවීන Background එකක්
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
    color: '#334155',
  },
  mainCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statBox: {
    width: (screenWidth - 32 - 12) / 2 - 8, // Screen එක මැදට කොටු 2 බැගින් සමානව බෙදීමට
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 120,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginVertical: 4,
  },
  statSubText: {
    fontSize: 10,
    color: '#64748B',
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  moreButtonText: {
    color: '#075EA7',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  mockPieChart: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'relative',
  },
  pieSegment: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    left: '50%',
    top: 0,
  },
  pieInnerCircle: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    top: 35,
    left: 35,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#475569',
  },
  barChartContainer: {
    gap: 14,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    width: 110,
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
    marginRight: 10,
  },
  barWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actualBar: {
    height: 12,
    borderRadius: 6,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  square: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },
  paymentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
});