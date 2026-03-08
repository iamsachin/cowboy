export interface ChartThemeColors {
  grid: string;
  text: string;
  legendText: string;
}

export function getChartThemeColors(): ChartThemeColors {
  const style = getComputedStyle(document.documentElement);
  return {
    grid: style.getPropertyValue('--chart-grid').trim() || 'rgba(255, 255, 255, 0.1)',
    text: style.getPropertyValue('--chart-text').trim() || 'rgba(255, 255, 255, 0.7)',
    legendText: style.getPropertyValue('--chart-legend').trim() || 'rgba(255, 255, 255, 0.7)',
  };
}
