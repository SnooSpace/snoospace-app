import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft,
  CalendarCheck,
  ShieldCheck,
  CircleCheck,
  Clock,
  CircleX,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../../constants/theme';
import { getAuthToken } from '../../../api/auth';
import { getMyVerification } from '../../../api/plans';
import SnooLoader from '../../../components/ui/SnooLoader';

function SectionLabel({ title }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function getStatusInfo(status) {
  switch (status) {
    case 'approved':
      return {
        label: 'Verified',
        ctaText: 'Verified',
        color: '#2E7D32',
        bgColor: 'rgba(46, 125, 50, 0.10)',
        Icon: CircleCheck,
      };
    case 'pending':
      return {
        label: 'Under review',
        ctaText: 'Under review',
        color: '#B45309',
        bgColor: 'rgba(180, 83, 9, 0.10)',
        Icon: Clock,
      };
    case 'rejected':
      return {
        label: 'Not approved',
        ctaText: 'Resubmit',
        color: '#C62828',
        bgColor: 'rgba(198, 40, 40, 0.10)',
        Icon: CircleX,
      };
    default:
      return {
        label: 'Not verified',
        ctaText: 'Get verified',
        color: COLORS.textSecondary,
        bgColor: 'rgba(107, 114, 128, 0.08)',
        Icon: null,
      };
  }
}

export default function VerificationHubScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plansVerification, setPlansVerification] = useState(null);
  const [discoverVerification, setDiscoverVerification] = useState(null);

  const fetchVerifications = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const [plansRes, discoverRes] = await Promise.all([
        getMyVerification(token, 'plans').catch(() => ({ verification: null })),
        getMyVerification(token, 'discover').catch(() => ({ verification: null })),
      ]);
      setPlansVerification(plansRes.verification);
      setDiscoverVerification(discoverRes.verification);
    } catch (err) {
      console.error('[VerificationHubScreen] error fetching verifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchVerifications();
    }, [fetchVerifications])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVerifications();
  }, [fetchVerifications]);

  const plansStatus = plansVerification?.status || 'unverified';
  const discoverStatus = discoverVerification?.status || 'unverified';

  const plansStatusInfo = getStatusInfo(plansStatus);
  const discoverStatusInfo = getStatusInfo(discoverStatus);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {/* Header intro */}
          <View style={styles.introBox}>
            <Text style={styles.introHeading}>Identity Verification</Text>
            <Text style={styles.introBody}>
              Choose a verification level to build trust and unlock features across SnooSpace.
            </Text>
          </View>

          {/* Tier 1: Plans Verification */}
          <SectionLabel title="Tier 1 • Open Plans" />
          <Card>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(0, 191, 165, 0.12)' }]}>
                <CalendarCheck size={22} color={COLORS.secondary} strokeWidth={2} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>Plans Verified</Text>
                <View style={[styles.statusBadge, { backgroundColor: plansStatusInfo.bgColor }]}>
                  {plansStatusInfo.Icon && (
                    <plansStatusInfo.Icon size={12} color={plansStatusInfo.color} strokeWidth={2} style={{ marginRight: 4 }} />
                  )}
                  <Text style={[styles.statusBadgeText, { color: plansStatusInfo.color }]}>
                    {plansStatusInfo.label}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              Upload a face photo and a short live video. Unlocks hosting and joining Open Plans.
            </Text>

            <TouchableOpacity
              style={[
                styles.ctaButton,
                { backgroundColor: COLORS.secondary },
                plansStatus === 'approved' && styles.ctaButtonApproved,
              ]}
              onPress={() => navigation.navigate('PlansVerification')}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaButtonText, plansStatus === 'approved' && styles.ctaButtonTextApproved]}>
                {plansStatusInfo.ctaText}
              </Text>
              {plansStatus !== 'approved' && (
                <ChevronRight size={18} color="#FFFFFF" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </Card>

          {/* Tier 2: Discover Verification */}
          <SectionLabel title="Tier 2 • Discover & Plans" />
          <Card>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(41, 98, 255, 0.10)' }]}>
                <ShieldCheck size={22} color={COLORS.primary} strokeWidth={2} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>Discover Verified</Text>
                <View style={[styles.statusBadge, { backgroundColor: discoverStatusInfo.bgColor }]}>
                  {discoverStatusInfo.Icon && (
                    <discoverStatusInfo.Icon size={12} color={discoverStatusInfo.color} strokeWidth={2} style={{ marginRight: 4 }} />
                  )}
                  <Text style={[styles.statusBadgeText, { color: discoverStatusInfo.color }]}>
                    {discoverStatusInfo.label}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              Confirms your Discover photos match a live video. Unlocks verified badge on Discover and Open Plans access.
            </Text>

            <TouchableOpacity
              style={[
                styles.ctaButton,
                { backgroundColor: COLORS.primary },
                discoverStatus === 'approved' && styles.ctaButtonApproved,
              ]}
              onPress={() => navigation.navigate('VerificationSubmit')}
              activeOpacity={0.85}
            >
              <Text style={[styles.ctaButtonText, discoverStatus === 'approved' && styles.ctaButtonTextApproved]}>
                {discoverStatusInfo.ctaText}
              </Text>
              {discoverStatus !== 'approved' && (
                <ChevronRight size={18} color="#FFFFFF" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  safeArea: {
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  introBox: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  introHeading: {
    fontFamily: FONTS.basicCommercialBlack,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  introBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: 18,
    ...SHADOWS.sm,
    shadowOpacity: 0.04,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  cardDescription: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  ctaButtonApproved: {
    backgroundColor: 'rgba(46, 125, 50, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.20)',
  },
  ctaButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  ctaButtonTextApproved: {
    color: '#2E7D32',
  },
});
