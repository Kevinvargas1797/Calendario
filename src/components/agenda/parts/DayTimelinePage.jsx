import React, { memo, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, View, Text } from "react-native";
import { PanGestureHandler, TapGestureHandler, State as GestureState } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import HourRow from "./HourRow";
import EventCard from "./EventCard";
import { clampMinutesInDay, minutesToY, snap, yToMinutes } from "../utils/timeMapping";

const DayTimelinePage = memo(
  forwardRef(function DayTimelinePage(
    {
      dateISO,
      rowHeight,
      labelColWidth,
      hours,
      showNowLine,
      nowY,
      nowLabel,
      events,
      onCreateEvent,
      onUpdateEvent,
      onScroll,
      styles,
    },
    ref
  ) {
    const NOW_H = 20;

    // Debug helper: visualize resize handle touch areas (including hitSlop).
    // Flip to false when done.
    const SHOW_HANDLE_HIT_AREAS = __DEV__ && true;

    const scrollViewRef = useRef(null);
    const setNativeScrollEnabled = useCallback((enabled) => {
      // Prevent ScrollView from stealing the pan before React state updates apply.
      // This is especially important for the top resize handle.
      scrollViewRef.current?.setNativeProps?.({ scrollEnabled: !!enabled });
    }, []);

    const [isCreating, setIsCreating] = useState(false);
    const isCreatingRef = useRef(false);
    const draftStartMinutesRef = useRef(0);
    const [draftStartMinutes, setDraftStartMinutes] = useState(0);

    // If a touch starts on an existing event card, we should NOT allow the
    // background "create" gesture to activate.
    const [isTouchingEvent, setIsTouchingEvent] = useState(false);
    const isTouchingEventRef = useRef(false);
    const tapBeganOnEventRef = useRef(false);
    const touchHadEventRef = useRef(false);
    const bgGestureBeganOnEventRef = useRef(false);
    const setTouchingEvent = useCallback((next) => {
      isTouchingEventRef.current = next;
      setIsTouchingEvent(next);
    }, []);

    // Stronger guard than "touching": once a gesture BEGAN on an event (drag or resize),
    // we must not allow the background create gesture to activate until that gesture ends.
    const [isEventGestureActive, setIsEventGestureActive] = useState(false);
    const isEventGestureActiveRef = useRef(false);
    const setEventGestureActive = useCallback((next) => {
      isEventGestureActiveRef.current = next;
      setIsEventGestureActive(next);
    }, []);

    // Visual feedback: darken the card while the user is pressing/trying to move it.
    const [pressedEventId, setPressedEventId] = useState(null);
    const pressedEventIdRef = useRef(null);
    const setPressed = useCallback((idOrNull) => {
      pressedEventIdRef.current = idOrNull;
      setPressedEventId(idOrNull);
    }, []);

    const [draggingEventId, setDraggingEventId] = useState(null);
    const draggingEventIdRef = useRef(null);
    const draggingStartMinutesRef = useRef(0);
    const draggingCurrentMinutesRef = useRef(0);
    const dragDidMoveRef = useRef(false);
    const [draggingStartMinutes, setDraggingStartMinutes] = useState(0);

    // Selected event persists after releasing.
    const [selectedEventId, setSelectedEventId] = useState(null);

    // Optimistic updates: when a resize/drag commits, keep the new size/position
    // locally so the card doesn't visually snap back while parent state updates.
    const [optimisticById, setOptimisticById] = useState({});
    const optimisticByIdRef = useRef({});
    const setOptimisticEvent = useCallback((id, patch) => {
      if (!id) return;
      const prev = optimisticByIdRef.current;
      const nextForId = {
        startMinutes:
          typeof patch?.startMinutes === "number"
            ? patch.startMinutes
            : typeof prev?.[id]?.startMinutes === "number"
              ? prev[id].startMinutes
              : undefined,
        durationMinutes:
          typeof patch?.durationMinutes === "number"
            ? patch.durationMinutes
            : typeof prev?.[id]?.durationMinutes === "number"
              ? prev[id].durationMinutes
              : undefined,
      };

      optimisticByIdRef.current = { ...prev, [id]: nextForId };
      setOptimisticById(optimisticByIdRef.current);
    }, []);

    useEffect(() => {
      if (!optimisticById || Object.keys(optimisticById).length === 0) return;
      if (!Array.isArray(events) || events.length === 0) {
        setOptimisticById({});
        return;
      }
      setOptimisticById((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((id) => {
          const live = events.find((e) => e.id === id);
          if (!live) {
            delete next[id];
            changed = true;
            return;
          }
          const o = next[id];
          if (
            o &&
            typeof o.startMinutes === "number" &&
            typeof o.durationMinutes === "number" &&
            live.startMinutes === o.startMinutes &&
            live.durationMinutes === o.durationMinutes
          ) {
            delete next[id];
            changed = true;
          }
        });
        if (!changed) return prev;
        optimisticByIdRef.current = next;
        return next;
      });
    }, [events, optimisticById]);

    // Resize state
    const [resizingEventId, setResizingEventId] = useState(null);
    const resizingEventIdRef = useRef(null);
    const resizeModeRef = useRef(null); // "top" | "bottom"
    const resizeBaseStartRef = useRef(0);
    const resizeBaseDurationRef = useRef(0);
    const resizeCurrentStartRef = useRef(0);
    const resizeCurrentDurationRef = useRef(0);
    const [resizingStartMinutes, setResizingStartMinutes] = useState(0);
    const [resizingDurationMinutes, setResizingDurationMinutes] = useState(0);

    const endEventGesture = useCallback(() => {
      draggingEventIdRef.current = null;
      resizingEventIdRef.current = null;
      resizeModeRef.current = null;
      setDraggingEventId(null);
      setResizingEventId(null);
      setNativeScrollEnabled(true);
      if (isTouchingEventRef.current) setTouchingEvent(false);
      if (pressedEventIdRef.current) setPressed(null);
      if (isEventGestureActiveRef.current) setEventGestureActive(false);
    }, [setEventGestureActive, setNativeScrollEnabled, setPressed, setTouchingEvent]);

    const forceResetInteractions = useCallback(() => {
      // Hard reset for edge cases where gesture-handler doesn't deliver END/CANCELLED.
      isCreatingRef.current = false;
      setIsCreating(false);
      draftPopScale.setValue(1);
      draftPopOpacity.setValue(1);

      touchHadEventRef.current = false;
      tapBeganOnEventRef.current = false;
      bgGestureBeganOnEventRef.current = false;

      draggingStartMinutesRef.current = 0;
      draggingCurrentMinutesRef.current = 0;
      resizeBaseStartRef.current = 0;
      resizeBaseDurationRef.current = 0;
      resizeCurrentStartRef.current = 0;
      resizeCurrentDurationRef.current = 0;

      setNativeScrollEnabled(true);

      endEventGesture();
    }, [draftPopOpacity, draftPopScale, endEventGesture, setNativeScrollEnabled]);

    // Safety net: after finishing drag/resize, ensure we don't keep the UI stuck.
    useEffect(() => {
      if (draggingEventId || resizingEventId) return;
      if (isTouchingEventRef.current) setTouchingEvent(false);
      if (pressedEventIdRef.current) setPressed(null);
      if (resizingEventIdRef.current) resizingEventIdRef.current = null;
      if (resizeModeRef.current) resizeModeRef.current = null;
      if (isEventGestureActiveRef.current) setEventGestureActive(false);
    }, [draggingEventId, resizingEventId, setTouchingEvent, setPressed]);

    // Safety net: after finishing a drag, make sure we don't keep the UI in a
    // "touching event" state (which would disable creating new events).
    useEffect(() => {
      if (draggingEventId) return;
      if (isTouchingEventRef.current) setTouchingEvent(false);
      if (pressedEventIdRef.current) setPressed(null);
      if (isEventGestureActiveRef.current) setEventGestureActive(false);
    }, [draggingEventId, setTouchingEvent, setPressed, setEventGestureActive]);

    const DEFAULT_DURATION_MIN = 30;
    const SNAP_MIN = 15;
    const DAY_END_MIN = 24 * 60;
    const MIN_EVENT_MIN = 5;

    // Make the background "create" gesture yield to event-card drag gestures.
    // This avoids inconsistent competition between nested PanGestureHandlers.
    const eventGestureRefsById = useRef({});
    const getEventGestureRef = useCallback((id) => {
      if (!eventGestureRefsById.current[id]) {
        eventGestureRefsById.current[id] = React.createRef();
      }
      return eventGestureRefsById.current[id];
    }, []);

    // Resize handle gesture refs per event
    const resizeGestureRefsByKey = useRef({});
    const getResizeGestureRef = useCallback((id, which) => {
      const key = `${id}:${which}`;
      if (!resizeGestureRefsByKey.current[key]) {
        resizeGestureRefsByKey.current[key] = React.createRef();
      }
      return resizeGestureRefsByKey.current[key];
    }, []);

    const eventWaitFor = useMemo(() => {
      if (!Array.isArray(events) || events.length === 0) return [];
      // Include resize handles too, so background-create waits for them.
      const refs = [];
      events.forEach((ev) => {
        refs.push(getEventGestureRef(ev.id));
        refs.push(getResizeGestureRef(ev.id, "top"));
        refs.push(getResizeGestureRef(ev.id, "bottom"));
      });
      return refs;
    }, [events, getEventGestureRef, getResizeGestureRef]);

    const totalDayHeight = useMemo(() => rowHeight * 24, [rowHeight]);

    // Pop animation for the draft card (when the create long-press activates).
    const draftPopScale = useRef(new Animated.Value(1)).current;
    const draftPopOpacity = useRef(new Animated.Value(1)).current;
    const runDraftPop = useCallback(() => {
      draftPopScale.stopAnimation();
      draftPopOpacity.stopAnimation();
      draftPopScale.setValue(0.92);
      draftPopOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(draftPopOpacity, {
          toValue: 1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.sequence([
          // Ultra-snappy pop: no spring tails.
          Animated.timing(draftPopScale, {
            toValue: 1.14,
            duration: 70,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(draftPopScale, {
            toValue: 0.99,
            duration: 50,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(draftPopScale, {
            toValue: 1,
            duration: 40,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Haptic right when the dark-blue draft appears.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, [draftPopOpacity, draftPopScale]);

    const draftTop = useMemo(
      () => minutesToY(rowHeight, draftStartMinutes),
      [rowHeight, draftStartMinutes]
    );
    const draftHeight = useMemo(
      () => (DEFAULT_DURATION_MIN / 60) * rowHeight,
      [DEFAULT_DURATION_MIN, rowHeight]
    );

    const setDraftFromY = (y) => {
      const rawMinutes = yToMinutes(rowHeight, y);
      const snapped = snap(rawMinutes, SNAP_MIN);
      const clamped = clampMinutesInDay(snapped);
      draftStartMinutesRef.current = clamped;
      setDraftStartMinutes(clamped);
    };

    const getMinutesFromY = (y) => {
      const rawMinutes = yToMinutes(rowHeight, y);
      const snapped = snap(rawMinutes, SNAP_MIN);
      return clampMinutesInDay(snapped);
    };

    return (
      <ScrollView
        ref={(node) => {
          scrollViewRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref && typeof ref === "object") ref.current = node;
        }}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onTouchEnd={() => {
          // Fallback: some ScrollView + gesture-handler combinations can prevent TapGestureHandler
          // from firing reliably. This ensures a simple tap on empty space deselects.
          if (isCreatingRef.current) {
            touchHadEventRef.current = false;
            return;
          }
          // If a gesture got stuck, allow outside tap to recover.
          if (touchHadEventRef.current) {
            touchHadEventRef.current = false;
            return;
          }
          touchHadEventRef.current = false;
          forceResetInteractions();
          setSelectedEventId(null);
        }}
        onScrollBeginDrag={() => {
          // Tocar/arrastrar fuera del evento debe quitar la selección
          setSelectedEventId(null);
        }}
        scrollEventThrottle={16}
        // No rebound at the edges (iOS + Android)
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        // Keep vertical scroll available; we only disable it during actual
        // create/drag operations.
        // Also disable while an event gesture is in progress (BEGAN -> END),
        // to avoid ScrollView cancelling the gesture and accidentally enabling
        // background-create mid-press.
        scrollEnabled={!isCreating && !draggingEventId && !resizingEventId && !isEventGestureActive}
      >
        {/* Dedicated short-tap handler so "tap outside" works reliably even though
            create requires a long-press (which often yields FAILED on quick taps). */}
        <TapGestureHandler
          maxDurationMs={220}
          shouldCancelWhenOutside={true}
          waitFor={eventWaitFor}
          // Keep this enabled even right after drag/resize ends; state updates can lag a render,
          // but refs are updated immediately. We'll gate inside the handler.
          // When an event is selected we use the Pressable overlay for outside taps.
          // This avoids TapGestureHandler/ScrollView edge cases.
          enabled={!isCreating && !selectedEventId}
          onHandlerStateChange={(e) => {
            const { state } = e.nativeEvent;

            if (state === GestureState.BEGAN) {
              // Snapshot whether THIS tap started on an event.
              tapBeganOnEventRef.current = isTouchingEventRef.current;
              return;
            }

            if (state !== GestureState.END) {
              if (
                state === GestureState.CANCELLED ||
                state === GestureState.FAILED ||
                state === GestureState.UNDETERMINED
              ) {
                tapBeganOnEventRef.current = false;
              }
              return;
            }

            if (isCreatingRef.current) return;
            if (isEventGestureActiveRef.current) return;
            if (draggingEventIdRef.current || resizingEventIdRef.current) return;
            // If THIS tap started on an event, do not deselect.
            if (tapBeganOnEventRef.current) {
              tapBeganOnEventRef.current = false;
              return;
            }
            if (isTouchingEventRef.current) return;
            tapBeganOnEventRef.current = false;
            setSelectedEventId(null);
          }}
        >
          <View>
            <PanGestureHandler
              activateAfterLongPress={250}
              shouldCancelWhenOutside={true}
              waitFor={eventWaitFor}
              // When an event is selected, taps should deselect reliably. The background
              // create-gesture can interfere with Pressables, so we disable it while selected.
              enabled={!draggingEventId && !resizingEventId && !isEventGestureActive && !selectedEventId}
              onGestureEvent={(e) => {
                if (!isCreatingRef.current) return;
                if (isTouchingEventRef.current) return;
                if (isEventGestureActiveRef.current) return;
                const { y } = e.nativeEvent;
                setDraftFromY(y);
              }}
              onHandlerStateChange={(e) => {
                const { state, y } = e.nativeEvent;

                if (state === GestureState.BEGAN) {
                  // Snapshot whether this background interaction started on an event.
                  // We cannot rely on isTouchingEventRef at END (it may be stale).
                  bgGestureBeganOnEventRef.current = isTouchingEventRef.current;
                  return;
                }

            if (state === GestureState.ACTIVE) {
              // If the finger is on an existing event, never create a new one.
              if (bgGestureBeganOnEventRef.current || isTouchingEventRef.current) return;
              if (isEventGestureActiveRef.current) return;
              // If this activated, we are definitely not interacting with a card.
              if (pressedEventIdRef.current) setPressed(null);
              if (isTouchingEventRef.current) setTouchingEvent(false);
              isCreatingRef.current = true;
              setIsCreating(true);
              setDraftFromY(y);
              runDraftPop();
              return;
            }

            if (state === GestureState.END) {
              if (!isCreatingRef.current) {
                // Tap rápido en el fondo: deselecciona.
                // (Si el tap fue sobre una card/handle, isTouchingEventRef se mantiene true.)
                if (
                  !bgGestureBeganOnEventRef.current &&
                  !isEventGestureActiveRef.current &&
                  !draggingEventIdRef.current &&
                  !resizingEventIdRef.current
                ) {
                  setSelectedEventId(null);
                }
                bgGestureBeganOnEventRef.current = false;
                return;
              }
              if (isTouchingEventRef.current) {
                // Safety: if we somehow ended while touching an event, don't create.
                isCreatingRef.current = false;
                setIsCreating(false);
                draftPopScale.setValue(1);
                draftPopOpacity.setValue(1);
                return;
              }
              if (isEventGestureActiveRef.current) {
                // Extra safety: never create while an event gesture was active.
                isCreatingRef.current = false;
                setIsCreating(false);
                draftPopScale.setValue(1);
                draftPopOpacity.setValue(1);
                return;
              }
              const startMinutes = draftStartMinutesRef.current;
              onCreateEvent?.({
                dateISO,
                startMinutes,
                durationMinutes: DEFAULT_DURATION_MIN,
              });
              isCreatingRef.current = false;
              setIsCreating(false);
              draftPopScale.setValue(1);
              draftPopOpacity.setValue(1);
              bgGestureBeganOnEventRef.current = false;
              return;
            }

            if (state === GestureState.CANCELLED || state === GestureState.FAILED) {
              // Quick tap on background often ends up as FAILED because this handler
              // requires a long-press to activate. Treat it as "tap outside" to deselect.
              if (
                !isCreatingRef.current &&
                !bgGestureBeganOnEventRef.current &&
                !isEventGestureActiveRef.current &&
                !draggingEventIdRef.current &&
                !resizingEventIdRef.current
              ) {
                setSelectedEventId(null);
              }
              isCreatingRef.current = false;
              setIsCreating(false);
              draftPopScale.setValue(1);
              draftPopOpacity.setValue(1);
              bgGestureBeganOnEventRef.current = false;
              return;
            }

            // Safety: if the handler returns to UNDETERMINED for any reason,
            // make sure creating can't get "stuck".
            if (state === GestureState.UNDETERMINED) {
              if (
                !isCreatingRef.current &&
                !bgGestureBeganOnEventRef.current &&
                !isEventGestureActiveRef.current &&
                !draggingEventIdRef.current &&
                !resizingEventIdRef.current
              ) {
                setSelectedEventId(null);
              }
              isCreatingRef.current = false;
              setIsCreating(false);
              draftPopScale.setValue(1);
              draftPopOpacity.setValue(1);
              bgGestureBeganOnEventRef.current = false;
            }
              }}
            >
              <View style={[styles.gridWrap, { height: totalDayHeight }]}>
            {hours.map((h) => (
              <HourRow key={h} hour={h} rowH={rowHeight} styles={styles} />
            ))}

            {/* Ultra-reliable "tap outside" layer.
                Only enabled while an event is selected; it sits above the grid but
                below event cards (which get higher zIndex). */}
            {!!selectedEventId && !isCreating && (
              <Pressable
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 5,
                }}
                pointerEvents="box-only"
                onPress={() => {
                  if (isCreatingRef.current) return;
                  // Always allow outside tap to recover from any stuck gesture state.
                  forceResetInteractions();
                  setSelectedEventId(null);
                }}
              />
            )}

            {Array.isArray(events) &&
              events.map((ev, evIndex) => {
                const isDraggingThis = draggingEventId === ev.id;
                const isPressedThis = pressedEventId === ev.id;
                const isResizingThis = resizingEventId === ev.id;
                const isSelectedThis = selectedEventId === ev.id;
                const optimistic = optimisticByIdRef.current?.[ev.id] || null;

                // Stacking: ensure the active card always renders above all others.
                const baseZ = 10 + evIndex;
                const activeZ = 9999;
                const selectedZ = 2000;
                const cardZ = isDraggingThis || isResizingThis ? activeZ : isSelectedThis ? selectedZ : baseZ;

                // Higher long-press delay avoids accidental selection while scrolling.
                // Still slightly faster when already selected.
                // UX:
                // - To SELECT an unselected card: require a long-press (0.3s) to avoid accidental selection while scrolling.
                //   This long-press only selects (does NOT start moving on the same gesture).
                // - When already selected: allow immediate drag (no long-press).
                const activateDragAfterLongPressMs = isSelectedThis ? 0 : 300;

                const startMin = isResizingThis
                  ? resizeCurrentStartRef.current
                  : isDraggingThis
                    ? draggingCurrentMinutesRef.current
                    : typeof optimistic?.startMinutes === "number"
                      ? optimistic.startMinutes
                      : ev.startMinutes;

                const durationMin = isResizingThis
                  ? resizeCurrentDurationRef.current
                  : typeof optimistic?.durationMinutes === "number"
                    ? optimistic.durationMinutes
                    : ev.durationMinutes;
                const top = minutesToY(rowHeight, startMin);
                const height = (durationMin / 60) * rowHeight;

                // Handle hit areas: ONLY around the dots (not the whole edge).
                const { width: SCREEN_W } = Dimensions.get("window");
                const cardLeft = labelColWidth + 10;
                const cardRight = typeof styles?.eventCard?.right === "number" ? styles.eventCard.right : 16;
                const cardW = Math.max(1, SCREEN_W - cardLeft - cardRight);
                // Keep in sync with EventCard dot positions.
                const DOT_R = 4.5;
                const TOP_DOT_RIGHT = 10;
                const BOT_DOT_LEFT = 10;
                const topHandleX = cardLeft + cardW - TOP_DOT_RIGHT - DOT_R;
                const botHandleX = cardLeft + BOT_DOT_LEFT + DOT_R;
                const HANDLE_HIT = 28;
                const TOP_HANDLE_HIT = HANDLE_HIT;
                const HANDLE_DOT_OUTSET = 6;

                // Touch target tuning (functional only; dot visuals stay the same).
                // Slightly smaller than before, and symmetric so we can visualize it as a circle.
                const TOP_HIT_SLOP = 12;
                const BOT_HIT_SLOP_X = 12;
                const BOT_HIT_SLOP_Y = 12;

                const TOP_TOUCH_SIZE = TOP_HANDLE_HIT + TOP_HIT_SLOP * 2;
                const BOT_TOUCH_W = HANDLE_HIT + BOT_HIT_SLOP_X * 2;
                const BOT_TOUCH_H = HANDLE_HIT + BOT_HIT_SLOP_Y * 2;

                // Center touch areas around the visible dot centers.
                // Dot is 9x9, positioned at top:-6 / bottom:-6; center offsets are ±1.5.
                const topDotCenterY = top - 1.5;
                const botDotCenterY = top + height + 1.5;

                // Clamp within the grid; Android can drop touches if outside bounds.
                const topTouchTop = Math.max(0, Math.min(totalDayHeight - TOP_TOUCH_SIZE, topDotCenterY - TOP_TOUCH_SIZE / 2));
                const botTouchTop = Math.max(0, Math.min(totalDayHeight - BOT_TOUCH_H, botDotCenterY - BOT_TOUCH_H / 2));


                return (
                  <React.Fragment key={ev.id}>
                    {/* Tap handler: do NOT select on tap (selection is long-press). */}
                    <TapGestureHandler
                      maxDurationMs={220}
                      maxDeltaX={8}
                      maxDeltaY={8}
                      shouldCancelWhenOutside={true}
                      waitFor={[
                        getEventGestureRef(ev.id),
                        getResizeGestureRef(ev.id, "top"),
                        getResizeGestureRef(ev.id, "bottom"),
                      ]}
                      enabled={!isCreating && !draggingEventId && !resizingEventId}
                      onHandlerStateChange={(e) => {
                        const { state } = e.nativeEvent;
                        if (state !== GestureState.END) return;
                        if (isCreatingRef.current) return;
                        if (isEventGestureActiveRef.current) return;
                        if (draggingEventIdRef.current || resizingEventIdRef.current) return;
                        // Intentionally no-op: selection happens on long-press.
                      }}
                    >
                    {/* Drag/move handler (long press) */}
                    <PanGestureHandler
                      ref={getEventGestureRef(ev.id)}
                      waitFor={[getResizeGestureRef(ev.id, "top"), getResizeGestureRef(ev.id, "bottom")]}
                      activateAfterLongPress={activateDragAfterLongPressMs}
                      // IMPORTANT: Avoid auto-select while scrolling.
                      // If the event is NOT selected, we only want selection via a true long-press
                      // (finger mostly still). Any meaningful movement should FAIL this handler
                      // so the ScrollView can take over without selecting.
                      // If the event IS selected, allow immediate drag (small movement activates).
                      activeOffsetY={isSelectedThis ? [-2, 2] : undefined}
                      failOffsetY={!isSelectedThis ? [-8, 8] : undefined}
                      failOffsetX={!isSelectedThis ? [-8, 8] : undefined}
                      shouldCancelWhenOutside={false}
                      enabled={!isCreating && !resizingEventId}
                      onGestureEvent={(e) => {
                        if (draggingEventIdRef.current !== ev.id) return;
                        const { translationY } = e.nativeEvent;
                        if (Math.abs(translationY) > 3) dragDidMoveRef.current = true;
                        const base = draggingStartMinutesRef.current;
                        const deltaMinutes = yToMinutes(rowHeight, translationY);
                        const next = clampMinutesInDay(snap(base + deltaMinutes, SNAP_MIN));
                        draggingCurrentMinutesRef.current = next;
                        setDraggingStartMinutes(next);

                        // Keep a live visual value so the card can't snap back.
                        optimisticByIdRef.current = {
                          ...optimisticByIdRef.current,
                          [ev.id]: {
                            startMinutes: next,
                            durationMinutes:
                              typeof optimisticByIdRef.current?.[ev.id]?.durationMinutes === "number"
                                ? optimisticByIdRef.current[ev.id].durationMinutes
                                : ev.durationMinutes,
                          },
                        };
                      }}
                      onHandlerStateChange={(e) => {
                        const { state } = e.nativeEvent;

                        if (state === GestureState.BEGAN) {
                          // Tap on card should NOT select; selection happens on long-press (ACTIVE).
                          // But we DO mark we're on an event to prevent background-create.
                          dragDidMoveRef.current = false;
                          setTouchingEvent(true);
                        }

                        if (state === GestureState.ACTIVE) {
                          dragDidMoveRef.current = false;
                          setNativeScrollEnabled(false);
                          setEventGestureActive(true);
                          setTouchingEvent(true);

                          if (!isSelectedThis) {
                            // First long-press: SELECT only (no move on this gesture).
                            void Haptics.selectionAsync().catch(() => {});
                            setSelectedEventId(ev.id);
                            setPressed(ev.id);
                            return;
                          }

                          // Already selected: start dragging immediately.
                          setPressed(ev.id);
                          draggingEventIdRef.current = ev.id;
                          const optimisticNow = optimisticByIdRef.current?.[ev.id] || null;
                          const baseStart =
                            typeof optimisticNow?.startMinutes === "number" ? optimisticNow.startMinutes : ev.startMinutes;
                          draggingStartMinutesRef.current = baseStart;
                          draggingCurrentMinutesRef.current = baseStart;
                          setDraggingEventId(ev.id);
                          setDraggingStartMinutes(baseStart);
                          return;
                        }

                        if (state === GestureState.END) {
                          // If it was a drag, commit move. If it was a tap, keep selection.
                          if (draggingEventIdRef.current === ev.id) {
                            if (dragDidMoveRef.current) {
                              const commitMinutes = draggingCurrentMinutesRef.current;
                              setOptimisticEvent(ev.id, {
                                startMinutes: commitMinutes,
                                durationMinutes: ev.durationMinutes,
                              });
                              onUpdateEvent?.({ dateISO, id: ev.id, startMinutes: commitMinutes });
                            }
                          }
                          dragDidMoveRef.current = false;
                          draggingEventIdRef.current = null;
                          setDraggingEventId(null);
                          endEventGesture();
                          return;
                        }

                        if (state === GestureState.CANCELLED || state === GestureState.FAILED) {
                          dragDidMoveRef.current = false;
                          draggingEventIdRef.current = null;
                          setDraggingEventId(null);
                          endEventGesture();
                          return;
                        }

                        if (state === GestureState.UNDETERMINED) {
                          dragDidMoveRef.current = false;
                          draggingEventIdRef.current = null;
                          setDraggingEventId(null);
                          endEventGesture();
                        }
                      }}
                    >
                      <EventCard
                        title={ev.title || "Evento"}
                        top={top}
                        height={Math.max(18, height)}
                        styles={styles}
                        startMinutes={startMin}
                        durationMinutes={durationMin}
                        selected={isSelectedThis || isDraggingThis || isResizingThis}
                        variant={isPressedThis ? "draft" : "solid"}
                        pointerEvents="auto"
                        layerStyle={{ zIndex: cardZ, elevation: cardZ }}
                        onTouchStart={() => {
                          // Mark: finger is on an event (blocks background create).
                          touchHadEventRef.current = true;
                          setTouchingEvent(true);
                        }}
                        onTouchEnd={() => {
                          // Do not clear while an event gesture is active; the gesture handlers
                          // own the lifecycle.
                          if (!isEventGestureActiveRef.current) setTouchingEvent(false);
                        }}
                        onTouchCancel={() => {
                          if (!isEventGestureActiveRef.current) setTouchingEvent(false);
                        }}
                      />
                    </PanGestureHandler>
                    </TapGestureHandler>

                    {/* Resize handles (only when selected and not dragging/creating) */}
                    {isSelectedThis && !isCreating && !isDraggingThis && (
                      <>
                        {/* Top handle: adjusts start (keeps end) */}
                        <PanGestureHandler
                          ref={getResizeGestureRef(ev.id, "top")}
                          shouldCancelWhenOutside={false}
                          enabled={!isCreating && !draggingEventId}
                          activeOffsetY={[-1, 1]}
                          minDist={0}
                          onGestureEvent={(e) => {
                            if (resizingEventIdRef.current !== ev.id) return;
                            if (resizeModeRef.current !== "top") return;
                            const { translationY } = e.nativeEvent;
                            const baseStart = resizeBaseStartRef.current;
                            const baseDur = resizeBaseDurationRef.current;
                            const baseEnd = Math.min(DAY_END_MIN, baseStart + baseDur);

                            const deltaMinutes = yToMinutes(rowHeight, translationY);
                            const nextStartRaw = snap(baseStart + deltaMinutes, SNAP_MIN);

                            const maxDur = Math.max(MIN_EVENT_MIN, DAY_END_MIN - 0);
                            void maxDur;
                            const minDur = Math.min(SNAP_MIN, Math.max(MIN_EVENT_MIN, baseEnd));
                            const maxStart = Math.max(0, baseEnd - minDur);
                            const nextStart = Math.max(0, Math.min(nextStartRaw, maxStart));
                            const nextDur = Math.max(minDur, baseEnd - nextStart);

                            resizeCurrentStartRef.current = nextStart;
                            resizeCurrentDurationRef.current = nextDur;
                            setResizingStartMinutes(nextStart);
                            setResizingDurationMinutes(nextDur);

                            // Keep a live visual value so the card can't snap back.
                            optimisticByIdRef.current = {
                              ...optimisticByIdRef.current,
                              [ev.id]: { startMinutes: nextStart, durationMinutes: nextDur },
                            };
                          }}
                          onHandlerStateChange={(e) => {
                            const { state } = e.nativeEvent;

                            if (state === GestureState.BEGAN) {
                              void Haptics.selectionAsync().catch(() => {});
                              setNativeScrollEnabled(false);
                              setEventGestureActive(true);
                              setTouchingEvent(true);
                              setSelectedEventId(ev.id);
                              resizingEventIdRef.current = ev.id;
                              resizeModeRef.current = "top";
                              const optimisticNow = optimisticByIdRef.current?.[ev.id] || null;
                              const baseStart =
                                typeof optimisticNow?.startMinutes === "number" ? optimisticNow.startMinutes : ev.startMinutes;
                              const baseDur =
                                typeof optimisticNow?.durationMinutes === "number"
                                  ? optimisticNow.durationMinutes
                                  : ev.durationMinutes;
                              resizeBaseStartRef.current = baseStart;
                              resizeBaseDurationRef.current = baseDur;
                              resizeCurrentStartRef.current = baseStart;
                              resizeCurrentDurationRef.current = baseDur;
                              setResizingEventId(ev.id);
                              setResizingStartMinutes(baseStart);
                              setResizingDurationMinutes(baseDur);
                            }

                            if (state === GestureState.END) {
                              if (resizingEventIdRef.current === ev.id) {
                                setOptimisticEvent(ev.id, {
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                                onUpdateEvent?.({
                                  dateISO,
                                  id: ev.id,
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                              }
                              resizingEventIdRef.current = null;
                              resizeModeRef.current = null;
                              endEventGesture();
                            }

                            if (state === GestureState.CANCELLED || state === GestureState.FAILED) {
                              if (resizingEventIdRef.current === ev.id) {
                                setOptimisticEvent(ev.id, {
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                                onUpdateEvent?.({
                                  dateISO,
                                  id: ev.id,
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                              }
                              resizingEventIdRef.current = null;
                              resizeModeRef.current = null;
                              endEventGesture();
                            }

                            if (state === GestureState.UNDETERMINED) {
                              if (resizingEventIdRef.current === ev.id) {
                                setOptimisticEvent(ev.id, {
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                                onUpdateEvent?.({
                                  dateISO,
                                  id: ev.id,
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                              }
                              resizingEventIdRef.current = null;
                              resizeModeRef.current = null;
                              endEventGesture();
                            }
                          }}
                        >
                          <View
                            style={{
                              position: "absolute",
                              // Make the ACTUAL handler view large (transparent) so touches
                              // anywhere in this region are captured reliably.
                              left: topHandleX - TOP_TOUCH_SIZE / 2,
                              top: topTouchTop,
                              width: TOP_TOUCH_SIZE,
                              height: TOP_TOUCH_SIZE,
                              zIndex: cardZ + 50,
                              elevation: cardZ + 50,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {SHOW_HANDLE_HIT_AREAS && (
                              <View
                                pointerEvents="none"
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  width: TOP_TOUCH_SIZE,
                                  height: TOP_TOUCH_SIZE,
                                  borderRadius: TOP_TOUCH_SIZE / 2,
                                  backgroundColor: "rgba(255, 0, 0, 0.12)",
                                  borderWidth: 1,
                                  borderColor: "rgba(255, 0, 0, 0.45)",
                                }}
                              />
                            )}
                          </View>
                        </PanGestureHandler>

                        {/* Bottom handle: adjusts duration */}
                        <PanGestureHandler
                          ref={getResizeGestureRef(ev.id, "bottom")}
                          shouldCancelWhenOutside={false}
                          enabled={!isCreating && !draggingEventId}
                          activeOffsetY={[-1, 1]}
                          minDist={0}
                          onGestureEvent={(e) => {
                            if (resizingEventIdRef.current !== ev.id) return;
                            if (resizeModeRef.current !== "bottom") return;
                            const { translationY } = e.nativeEvent;
                            const baseStart = resizeBaseStartRef.current;
                            const baseDur = resizeBaseDurationRef.current;
                            const deltaMinutes = yToMinutes(rowHeight, translationY);
                            const nextDurRaw = snap(baseDur + deltaMinutes, SNAP_MIN);

                            const maxDur = Math.max(MIN_EVENT_MIN, DAY_END_MIN - baseStart);
                            const minDur = Math.min(SNAP_MIN, maxDur);
                            const nextDur = Math.max(minDur, Math.min(nextDurRaw, maxDur));

                            resizeCurrentStartRef.current = baseStart;
                            resizeCurrentDurationRef.current = nextDur;
                            setResizingStartMinutes(baseStart);
                            setResizingDurationMinutes(nextDur);

                            // Keep a live visual value so the card can't snap back.
                            optimisticByIdRef.current = {
                              ...optimisticByIdRef.current,
                              [ev.id]: { startMinutes: baseStart, durationMinutes: nextDur },
                            };
                          }}
                          onHandlerStateChange={(e) => {
                            const { state } = e.nativeEvent;

                            if (state === GestureState.BEGAN) {
                              void Haptics.selectionAsync().catch(() => {});
                              setNativeScrollEnabled(false);
                              setEventGestureActive(true);
                              setTouchingEvent(true);
                              setSelectedEventId(ev.id);
                              resizingEventIdRef.current = ev.id;
                              resizeModeRef.current = "bottom";
                              const optimisticNow = optimisticByIdRef.current?.[ev.id] || null;
                              const baseStart =
                                typeof optimisticNow?.startMinutes === "number" ? optimisticNow.startMinutes : ev.startMinutes;
                              const baseDur =
                                typeof optimisticNow?.durationMinutes === "number"
                                  ? optimisticNow.durationMinutes
                                  : ev.durationMinutes;
                              resizeBaseStartRef.current = baseStart;
                              resizeBaseDurationRef.current = baseDur;
                              resizeCurrentStartRef.current = baseStart;
                              resizeCurrentDurationRef.current = baseDur;
                              setResizingEventId(ev.id);
                              setResizingStartMinutes(baseStart);
                              setResizingDurationMinutes(baseDur);
                            }

                            if (state === GestureState.END) {
                              if (resizingEventIdRef.current === ev.id) {
                                setOptimisticEvent(ev.id, {
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                                onUpdateEvent?.({
                                  dateISO,
                                  id: ev.id,
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                              }
                              resizingEventIdRef.current = null;
                              resizeModeRef.current = null;
                              endEventGesture();
                            }

                            if (state === GestureState.CANCELLED || state === GestureState.FAILED) {
                              if (resizingEventIdRef.current === ev.id) {
                                setOptimisticEvent(ev.id, {
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                                onUpdateEvent?.({
                                  dateISO,
                                  id: ev.id,
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                              }
                              resizingEventIdRef.current = null;
                              resizeModeRef.current = null;
                              endEventGesture();
                            }

                            if (state === GestureState.UNDETERMINED) {
                              if (resizingEventIdRef.current === ev.id) {
                                setOptimisticEvent(ev.id, {
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                                onUpdateEvent?.({
                                  dateISO,
                                  id: ev.id,
                                  startMinutes: resizeCurrentStartRef.current,
                                  durationMinutes: resizeCurrentDurationRef.current,
                                });
                              }
                              resizingEventIdRef.current = null;
                              resizeModeRef.current = null;
                              endEventGesture();
                            }
                          }}
                        >
                          <View
                            style={{
                              position: "absolute",
                              left: botHandleX - BOT_TOUCH_W / 2,
                              top: botTouchTop,
                              width: BOT_TOUCH_W,
                              height: BOT_TOUCH_H,
                              zIndex: cardZ + 5,
                              elevation: cardZ + 5,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {SHOW_HANDLE_HIT_AREAS && (
                              <View
                                pointerEvents="none"
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  width: BOT_TOUCH_W,
                                  height: BOT_TOUCH_H,
                                  borderRadius: Math.min(BOT_TOUCH_W, BOT_TOUCH_H) / 2,
                                  backgroundColor: "rgba(0, 200, 255, 0.10)",
                                  borderWidth: 1,
                                  borderColor: "rgba(0, 200, 255, 0.45)",
                                }}
                              />
                            )}
                          </View>
                        </PanGestureHandler>
                      </>
                    )}
                  </React.Fragment>
                );
              })}

            {isCreating && (
              <EventCard
                title="Nuevo evento"
                top={draftTop}
                height={draftHeight}
                styles={styles}
                startMinutes={draftStartMinutes}
                durationMinutes={DEFAULT_DURATION_MIN}
                // While the finger is down creating the event, show it as selected.
                selected={true}
                variant="draft"
                pointerEvents="none"
                layerStyle={{ zIndex: 10000, elevation: 10000 }}
                animatedStyle={{
                  transform: [{ scale: draftPopScale }],
                  opacity: draftPopOpacity,
                }}
              />
            )}

            {showNowLine && typeof nowY === "number" && (
              <View
                pointerEvents="none"
                style={[styles.nowLineWrap, { top: nowY - NOW_H / 2, height: NOW_H }]}
              >
                <View style={styles.nowLineRule} />
                <View style={styles.nowPillWrap}>
                  <View style={styles.nowPill}>
                    <Text style={styles.nowPillText}>{nowLabel || ""}</Text>
                  </View>
                </View>
              </View>
            )}
              </View>
            </PanGestureHandler>
          </View>
        </TapGestureHandler>
      </ScrollView>
    );
  })
);

DayTimelinePage.displayName = "DayTimelinePage";

export default DayTimelinePage;
