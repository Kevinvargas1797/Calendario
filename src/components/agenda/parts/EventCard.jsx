import React, { memo, forwardRef } from "react";
import { Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatEventTimeRange } from "../utils/eventTimeFormat";
import eventCardHandleDotStyles from "./eventCardHandleDotStyles";

const EventCard = memo(
  forwardRef(function EventCard(
    {
      title,
      top,
      height,
      styles,
      startMinutes,
      durationMinutes,
      selected = false,
      variant = "solid",
      pointerEvents = "auto",
      layerStyle,
      animatedStyle,
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
      isTight = false,
      isUltraTight = false,
      showMeta = true,
      metaIconColor,
    },
    ref
  ) {
    const tightContainerStyle = isTight ? { rowGap: 1, justifyContent: "flex-start" } : null;
    const tightTitleStyle = isTight
      ? {
          fontSize: 14,
          lineHeight: 16,
        }
      : null;
    const tightMetaStyle = isTight
      ? {
          fontSize: 12,
          lineHeight: 14,
        }
      : null;
    return (
      <Animated.View
        ref={ref}
        collapsable={false}
        pointerEvents={pointerEvents}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        style={[
          styles.eventCard,
          variant === "draft" && styles.eventCardDraft,
          selected && styles.eventCardSelected,
          { top, height },
          layerStyle,
          tightContainerStyle,
          animatedStyle,
        ]}
      >
        <View style={[styles.eventCardAccentBar, selected && { opacity: 0 }]} />
        <View style={[styles.eventCardContent, tightContainerStyle]}>
          {!isUltraTight && (
            <Text
              numberOfLines={1}
              style={[
                styles.eventCardTitle,
                selected && styles.eventCardTitleSelected,
                tightTitleStyle,
              ]}
            >
              {title}
            </Text>
          )}

          {showMeta && (
            <View style={styles.eventCardMetaRow}>
              <Ionicons
                name="time-outline"
                size={isTight ? 13 : 14}
                color={metaIconColor || "#607180"}
                style={[
                  styles.eventCardMetaIcon,
                  selected && styles.eventCardMetaIconSelected,
                ]}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.eventCardMetaText,
                  selected && styles.eventCardMetaTextSelected,
                  tightMetaStyle,
                ]}
              >
                {formatEventTimeRange(startMinutes, durationMinutes)}
              </Text>
            </View>
          )}
        </View>
        {/* Render handles last so they appear above the card */}
        {selected && variant !== "draft" && (
          <>
            {/* Área de selección/handle superior */}
            <View
              style={[
                eventCardHandleDotStyles.eventCardHandleDot,
                { top: -6, right: 10 },
              ]}
              pointerEvents="none"
            />
            {/* Área de selección/handle inferior */}
            <View
              style={[
                eventCardHandleDotStyles.eventCardHandleDot,
                { bottom: -6, left: 10 },
              ]}
              pointerEvents="none"
            />
          </>
        )}
      </Animated.View>
    );
  })
);

export default EventCard;
