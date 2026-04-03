export interface ChartThemeColors {
  grid: string;
  text: string;
  legendText: string;
  inputBorder: string;
  inputFill: string;
  outputBorder: string;
  outputFill: string;
}

export function getChartThemeColors(): ChartThemeColors {
  const style = getComputedStyle(document.documentElement);
  return {
    grid: style.getPropertyValue('--chart-grid').trim() || 'rgba(255, 255, 255, 0.1)',
    text: style.getPropertyValue('--chart-text').trim() || 'rgba(255, 255, 255, 0.7)',
    legendText: style.getPropertyValue('--chart-legend').trim() || 'rgba(255, 255, 255, 0.7)',
    inputBorder: style.getPropertyValue('--chart-input-border').trim() || 'rgba(56, 189, 248, 1)',
    inputFill: style.getPropertyValue('--chart-input-fill').trim() || 'rgba(56, 189, 248, 0.2)',
    outputBorder: style.getPropertyValue('--chart-output-border').trim() || 'rgba(192, 132, 252, 1)',
    outputFill: style.getPropertyValue('--chart-output-fill').trim() || 'rgba(192, 132, 252, 0.2)',
  };
}
