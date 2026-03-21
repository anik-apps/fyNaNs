import React, { useState } from "react";
import { View, Text, StyleSheet, GestureResponderEvent } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { formatCurrency } from "@/src/lib/utils";
import { useTheme } from "@/src/providers/ThemeProvider";

export interface CategorySlice {
  name: string;
  color: string;
  total: number;
}

interface CategoryDonutChartProps {
  data: CategorySlice[];
  size?: number;
  strokeWidth?: number;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  // For a full circle, draw two half-arcs
  if (endAngle - startAngle >= 359.99) {
    const mid = startAngle + 180;
    const s1 = polarToCartesian(cx, cy, r, startAngle);
    const m = polarToCartesian(cx, cy, r, mid);
    return [
      `M ${s1.x} ${s1.y}`,
      `A ${r} ${r} 0 1 1 ${m.x} ${m.y}`,
      `A ${r} ${r} 0 1 1 ${s1.x} ${s1.y}`,
    ].join(" ");
  }

  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
  ].join(" ");
}

export function CategoryDonutChart({
  data,
  size = 140,
  strokeWidth = 20,
}: CategoryDonutChartProps) {
  const { theme } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.total, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const gap = data.length > 1 ? 2 : 0; // degrees gap between slices

  // Build arcs
  const arcs: Array<{
    path: string;
    color: string;
    startAngle: number;
    endAngle: number;
    midAngle: number;
  }> = [];
  let currentAngle = 0;

  for (let i = 0; i < data.length; i++) {
    const sweep = (data[i].total / total) * 360;
    const startAngle = currentAngle + gap / 2;
    const endAngle = currentAngle + sweep - gap / 2;
    const midAngle = currentAngle + sweep / 2;

    if (sweep > gap) {
      arcs.push({
        path: describeArc(cx, cy, radius, startAngle, endAngle),
        color: data[i].color,
        startAngle,
        endAngle,
        midAngle,
      });
    }
    currentAngle += sweep;
  }

  function handleTouch(e: GestureResponderEvent) {
    const { locationX, locationY } = e.nativeEvent;
    const dx = locationX - cx;
    const dy = locationY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only respond to touches near the ring
    if (dist < radius - strokeWidth || dist > radius + strokeWidth / 2) {
      setSelectedIndex(null);
      return;
    }

    // Compute angle (0 = top, clockwise)
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    // Find which segment
    let cumAngle = 0;
    for (let i = 0; i < data.length; i++) {
      const sweep = (data[i].total / total) * 360;
      if (angle >= cumAngle && angle < cumAngle + sweep) {
        setSelectedIndex(i);
        return;
      }
      cumAngle += sweep;
    }
    setSelectedIndex(null);
  }

  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  return (
    <View style={styles.container}>
      <View
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderRelease={() =>
          setTimeout(() => setSelectedIndex(null), 3000)
        }
      >
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={theme.colors.border}
            strokeWidth={strokeWidth}
          />
          {/* Arcs */}
          {arcs.map((arc, i) => (
            <Path
              key={i}
              d={arc.path}
              fill="none"
              stroke={arc.color}
              strokeWidth={
                selectedIndex === i ? strokeWidth + 4 : strokeWidth
              }
              strokeLinecap="round"
              opacity={
                selectedIndex === null || selectedIndex === i ? 1 : 0.35
              }
            />
          ))}
        </Svg>

        {/* Center label */}
        <View style={[styles.centerLabel, { width: size, height: size }]}>
          {selected ? (
            <>
              <Text
                style={[styles.centerName, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {selected.name}
              </Text>
              <Text
                style={[
                  styles.centerAmount,
                  { color: theme.colors.text },
                ]}
              >
                {formatCurrency(selected.total)}
              </Text>
              <Text
                style={[
                  styles.centerPercent,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {((selected.total / total) * 100).toFixed(0)}%
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.centerName,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Total
              </Text>
              <Text
                style={[styles.centerAmount, { color: theme.colors.text }]}
              >
                {formatCurrency(total)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.slice(0, 5).map((cat, i) => (
          <View
            key={cat.name}
            style={[
              styles.legendItem,
              selectedIndex !== null &&
                selectedIndex !== i && { opacity: 0.4 },
            ]}
          >
            <View
              style={[styles.legendDot, { backgroundColor: cat.color }]}
            />
            <Text
              style={[styles.legendName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
            <Text
              style={[
                styles.legendAmount,
                { color: theme.colors.textSecondary },
              ]}
            >
              {formatCurrency(cat.total)}
            </Text>
          </View>
        ))}
        {data.length > 5 && (
          <Text
            style={[styles.moreText, { color: theme.colors.textSecondary }]}
          >
            +{data.length - 5} more
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  centerLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  centerName: {
    fontSize: 11,
    fontWeight: "500",
    maxWidth: 80,
  },
  centerAmount: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 1,
  },
  centerPercent: {
    fontSize: 10,
    marginTop: 1,
  },
  legend: {
    marginTop: 12,
    width: "100%",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendName: {
    fontSize: 12,
    flex: 1,
  },
  legendAmount: {
    fontSize: 12,
    fontWeight: "500",
  },
  moreText: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});
