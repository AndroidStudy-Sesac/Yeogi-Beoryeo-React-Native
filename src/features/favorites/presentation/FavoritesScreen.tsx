import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  APP_SCREEN_ROUTES,
  BOTTOM_TAB_ROUTES,
  type AppTabParamList,
  type FavoriteCategory,
  type FavoritesStackParamList,
} from '../../../app/navigation/routes';
import { MessageSnackbar } from '../../../common/presentation/MessageSnackbar';
import {
  ErrorOutlineIcon,
  FavoriteIcon,
  HomePinIcon,
} from '../../../common/presentation/StatusIcons';
import { formatRegionSelection } from '../../regional-guide/domain/Region';
import type { RegionalGuideFavorite } from '../../regional-guide/domain/regionalGuideFavorite';
import { useHomeRegionalGuideRepresentative } from '../../regional-guide/presentation/HomeRegionalGuideRepresentativeContext';
import { useRegionalGuideFavorites } from '../../regional-guide/presentation/RegionalGuideFavoritesContext';

const CATEGORIES: readonly Readonly<{
  id: FavoriteCategory;
  label: string;
}>[] = [
  { id: 'ITEM', label: '품목' },
  { id: 'PLACE', label: '장소' },
  { id: 'REGIONAL_GUIDE', label: '지역' },
];

const FAVORITE_UPDATE_FAILED_MESSAGE =
  '즐겨찾기를 변경하지 못했어요. 다시 시도해 주세요.';

const EMPTY_CONTENT: Readonly<
  Record<
    FavoriteCategory,
    Readonly<{ actionLabel: string; description: string; title: string }>
  >
> = {
  ITEM: {
    title: '아직 즐겨찾기한 품목이 없어요',
    description: '품목 가이드 상세 화면에서 별을 누르면 여기에 모아볼 수 있어요.',
    actionLabel: '품목 검색하기',
  },
  PLACE: {
    title: '즐겨찾기한 수거 장소가 없어요',
    description: '지도에서 자주 확인하는 수거 장소를 즐겨찾기에 추가해 보세요.',
    actionLabel: '지도에서 수거 장소 찾아보기',
  },
  REGIONAL_GUIDE: {
    title: '아직 즐겨찾기한 지역 가이드가 없어요',
    description: '지역 가이드 즐겨찾기 연결 후 이곳에서 모아볼 수 있어요.',
    actionLabel: '지역별 배출 가이드 찾아보기',
  },
};

export function FavoritesScreen({
  route,
}: Readonly<{
  route?: RouteProp<FavoritesStackParamList, 'Favorites'>;
}> = {}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<FavoritesStackParamList>>();
  const [selectedCategory, setSelectedCategory] =
    useState<FavoriteCategory>('ITEM');
  const category = route?.params?.initialCategory ?? selectedCategory;
  const favorites = useRegionalGuideFavorites();
  const representative = useHomeRegionalGuideRepresentative();
  const favoriteMutationError = favorites.mutationError;
  const clearFavoriteMutationError = favorites.clearMutationError;
  const representativeMutationError = representative.mutationError;
  const clearRepresentativeMutationError = representative.clearMutationError;
  const tabNavigation = () =>
    navigation.getParent<BottomTabNavigationProp<AppTabParamList>>();

  const selectCategory = useCallback(
    (nextCategory: FavoriteCategory) => {
      setSelectedCategory(nextCategory);
      if (route?.params?.initialCategory) {
        navigation.setParams({ initialCategory: undefined });
      }
    },
    [navigation, route?.params?.initialCategory],
  );

  useEffect(() => {
    if (!favoriteMutationError && !representativeMutationError) return undefined;
    const timeoutId = setTimeout(() => {
      clearFavoriteMutationError();
      clearRepresentativeMutationError();
    }, 4_000);
    return () => clearTimeout(timeoutId);
  }, [
    clearFavoriteMutationError,
    clearRepresentativeMutationError,
    favoriteMutationError,
    representativeMutationError,
  ]);

  const openCategorySearch = (selectedCategory: FavoriteCategory) => {
    switch (selectedCategory) {
      case 'ITEM':
        tabNavigation()?.navigate(BOTTOM_TAB_ROUTES.HOME, {
          screen: APP_SCREEN_ROUTES.ITEM_SEARCH,
        });
        break;
      case 'PLACE':
        tabNavigation()?.navigate(BOTTOM_TAB_ROUTES.MAP, {
          screen: APP_SCREEN_ROUTES.MAP,
        });
        break;
      case 'REGIONAL_GUIDE':
        tabNavigation()?.navigate(BOTTOM_TAB_ROUTES.REGIONAL_GUIDE, {
          screen: APP_SCREEN_ROUTES.REGIONAL_GUIDE,
        });
        break;
    }
  };

  const openFavorite = (favorite: RegionalGuideFavorite) => {
    navigation.navigate(APP_SCREEN_ROUTES.REGIONAL_GUIDE, {
      entrySource: 'FAVORITES',
      initialFavoriteTargetId: favorite.targetId,
    });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={styles.title}>
          즐겨찾기
        </Text>

        <FavoriteTabRow selectedCategory={category} onSelect={selectCategory} />

        <FavoritesContent
          category={category}
          favorites={favorites.favorites}
          loadState={favorites.loadState}
          onAction={() => openCategorySearch(category)}
          onOpenFavorite={openFavorite}
          onToggleRepresentative={favorite => {
            void representative.toggle(favorite.targetId).catch(() => undefined);
          }}
          onRemove={favorite => {
            void favorites.setFavorite(favorite, false).catch(() => undefined);
          }}
          onRetry={() => void favorites.retryLoad()}
          pendingTargetIds={new Set(
            favorites.favorites
              .filter(favorite => favorites.isPending(favorite.targetId))
              .map(favorite => favorite.targetId),
          )}
          representativePending={representative.isPending}
          representativePendingTargetId={representative.pendingTargetId}
          representativeTargetId={representative.targetId}
        />
      </ScrollView>

      {favorites.mutationError || representative.mutationError ? (
        <MessageSnackbar
          message={representative.mutationError ?? FAVORITE_UPDATE_FAILED_MESSAGE}
        />
      ) : null}
    </SafeAreaView>
  );
}

function FavoriteTabRow({
  selectedCategory,
  onSelect,
}: Readonly<{
  selectedCategory: FavoriteCategory;
  onSelect(category: FavoriteCategory): void;
}>) {
  return (
    <View accessibilityRole="tablist" style={styles.categories}>
      {CATEGORIES.map(item => {
        const selected = selectedCategory === item.id;
        return (
          <Pressable
            accessibilityLabel={`${item.label} 즐겨찾기 카테고리`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.category,
              selected && styles.selectedCategory,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                selected && styles.selectedCategoryText,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FavoritesContent({
  category,
  favorites,
  loadState,
  onAction,
  onOpenFavorite,
  onRemove,
  onRetry,
  onToggleRepresentative,
  pendingTargetIds,
  representativePending,
  representativePendingTargetId,
  representativeTargetId,
}: Readonly<{
  category: FavoriteCategory;
  favorites: readonly RegionalGuideFavorite[];
  loadState: 'loading' | 'ready' | 'error';
  onAction(): void;
  onOpenFavorite(favorite: RegionalGuideFavorite): void;
  onRemove(favorite: RegionalGuideFavorite): void;
  onRetry(): void;
  onToggleRepresentative(favorite: RegionalGuideFavorite): void;
  pendingTargetIds: ReadonlySet<string>;
  representativePending: boolean;
  representativePendingTargetId?: string;
  representativeTargetId?: string;
}>) {
  if (loadState === 'loading') {
    return (
      <View
        accessibilityLabel="로딩 중"
        accessibilityLiveRegion="polite"
        style={styles.loading}
      >
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <FavoritesStatusCard
        actionLabel="다시 시도"
        description="잠시 후 다시 시도해 주세요."
        icon="error"
        onAction={onRetry}
        title="즐겨찾기를 불러오지 못했어요"
      />
    );
  }

  if (category !== 'REGIONAL_GUIDE' || favorites.length === 0) {
    const emptyContent = EMPTY_CONTENT[category];
    return (
      <FavoritesStatusCard
        actionLabel={emptyContent.actionLabel}
        description={emptyContent.description}
        icon="favorite"
        onAction={onAction}
        title={emptyContent.title}
      />
    );
  }

  return (
    <View style={styles.favoriteList}>
      {favorites.map(favorite => (
        <FavoriteCard
          favorite={favorite}
          key={favorite.targetId}
          onOpen={() => onOpenFavorite(favorite)}
          onRemove={() => onRemove(favorite)}
          onToggleRepresentative={() => onToggleRepresentative(favorite)}
          pending={pendingTargetIds.has(favorite.targetId)}
          representative={representativeTargetId === favorite.targetId}
          representativePending={representativePending}
          showRepresentativeProgress={
            representativePendingTargetId === favorite.targetId
          }
        />
      ))}
    </View>
  );
}

function FavoritesStatusCard({
  actionLabel,
  description,
  icon,
  onAction,
  title,
}: Readonly<{
  actionLabel: string;
  description: string;
  icon: 'error' | 'favorite';
  onAction(): void;
  title: string;
}>) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.statusCard}>
      {icon === 'favorite' ? (
        <FavoriteIcon color={COLORS.tertiary} />
      ) : (
        <ErrorOutlineIcon color={COLORS.error} />
      )}
      <Text accessibilityRole="header" style={styles.statusTitle}>
        {title}
      </Text>
      <Text style={styles.statusDescription}>{description}</Text>
      <ActionButton label={actionLabel} onPress={onAction} />
    </View>
  );
}

function FavoriteCard({
  favorite,
  onOpen,
  onRemove,
  onToggleRepresentative,
  pending,
  representative,
  representativePending,
  showRepresentativeProgress,
}: Readonly<{
  favorite: RegionalGuideFavorite;
  onOpen(): void;
  onRemove(): void;
  onToggleRepresentative(): void;
  pending: boolean;
  representative: boolean;
  representativePending: boolean;
  showRepresentativeProgress: boolean;
}>) {
  const regionPath = formatRegionSelection(favorite.selection);
  const title =
    regionPath ||
    favorite.identity.targetRegionName ||
    favorite.identity.managementZoneName ||
    '지역 가이드';
  const subtitle = [
    favorite.identity.targetRegionName,
    favorite.identity.managementZoneName,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' · ');
  const accessibilityName = [title, subtitle].filter(Boolean).join(', ');

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityHint="저장한 조건으로 최신 지역 가이드를 다시 조회합니다."
        accessibilityLabel={`${accessibilityName} 지역 가이드 보기`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [
          styles.cardBody,
          pressed && styles.pressed,
        ]}
      >
        <Text numberOfLines={2} style={styles.cardTitle}>
          {title}
        </Text>
        {subtitle ? (
          <View style={styles.metadataChip}>
            <Text numberOfLines={1} style={styles.metadataText}>
              {subtitle}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityHint={
          representative
            ? '누르면 홈 대표 지역 고정을 해제합니다.'
            : '누르면 홈 요약에 표시할 대표 지역으로 고정합니다.'
        }
        accessibilityLabel={`${accessibilityName} ${representative ? '홈 지역 가이드 고정 해제' : '홈 지역 가이드로 고정'}`}
        accessibilityRole="button"
        accessibilityState={{
          busy: representativePending,
          disabled: pending || representativePending,
          selected: representative,
        }}
        disabled={pending || representativePending}
        hitSlop={4}
        onPress={onToggleRepresentative}
        style={({ pressed }) => [
          styles.pinButton,
          pressed && styles.pressed,
        ]}
      >
        {showRepresentativeProgress ? (
          <ActivityIndicator color={COLORS.primary} size="small" />
        ) : (
          <HomePinIcon
            color={representative ? COLORS.primary : COLORS.onSurfaceVariant}
            filled={representative}
            size={20}
          />
        )}
      </Pressable>

      <Pressable
        accessibilityHint="누르면 즐겨찾기에서 삭제됩니다."
        accessibilityLabel={`${accessibilityName} 즐겨찾기 해제`}
        accessibilityRole="button"
        accessibilityState={{ busy: pending, disabled: pending, selected: true }}
        disabled={pending}
        hitSlop={4}
        onPress={onRemove}
        style={({ pressed }) => [
          styles.favoriteButton,
          pressed && styles.pressed,
        ]}
      >
        {pending ? (
          <ActivityIndicator color={COLORS.tertiary} size="small" />
        ) : (
          <FavoriteIcon color={COLORS.tertiary} filled size={20} />
        )}
      </Pressable>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
}: Readonly<{ label: string; onPress(): void }>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const COLORS = {
  background: '#FFFFFF',
  error: '#D32F2F',
  onPrimary: '#FFFFFF',
  onSecondaryContainer: '#173A08',
  onSurface: '#1A1C19',
  onSurfaceVariant: '#424940',
  outlineVariant: '#DDE5DD',
  primary: '#2E7D32',
  secondaryContainer: '#E8F5E0',
  surface: '#FFFFFF',
  tertiary: '#F9A825',
} as const;

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  content: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  categories: {
    borderBottomColor: COLORS.outlineVariant,
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  category: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  selectedCategory: {
    borderBottomColor: COLORS.primary,
    borderBottomWidth: 3,
  },
  categoryText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  selectedCategoryText: { color: COLORS.primary },
  loading: {
    alignItems: 'center',
    flex: 1,
    paddingTop: 96,
  },
  statusCard: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  statusTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  statusDescription: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: COLORS.onPrimary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  favoriteList: { gap: 16 },
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.outlineVariant,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    gap: 8,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingTop: 20,
  },
  cardTitle: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  metadataChip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondaryContainer,
    borderRadius: 8,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metadataText: {
    color: COLORS.onSecondaryContainer,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  favoriteButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginRight: 20,
    width: 48,
  },
  pinButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginLeft: 12,
    width: 48,
  },
  pressed: { opacity: 0.7 },
});
