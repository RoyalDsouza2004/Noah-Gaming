import React, { useState } from 'react';

/**
 * Interactive Area & Line Trend Chart (SVG-based, responsive, zero external dependencies)
 */
export const AreaTrendChart = ({
  data = [],
  dataKey = 'netRupees',
  labelKey = 'date',
  strokeColor = '#00E5FF',
  fillGradient = ['rgba(0, 229, 255, 0.35)', 'rgba(0, 229, 255, 0.0)'],
  height = 260,
  valuePrefix = '₹',
  valueFormatter = (v) => `${valuePrefix}${Number(v).toLocaleString('en-IN')}`,
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm italic">
        No trend records available for selected period.
      </div>
    );
  }

  const values = data.map((d) => Number(d[dataKey]) || 0);
  const maxVal = Math.max(...values, 10);
  const minVal = 0;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = 700;
  const chartHeight = height;

  const getX = (idx) => {
    if (data.length <= 1) return chartWidth / 2;
    return paddingX + (idx / (data.length - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (val) => {
    const range = maxVal - minVal;
    return chartHeight - paddingY - (val / range) * (chartHeight - paddingY * 2);
  };

  // Generate smooth SVG curve path
  const points = data.map((d, i) => `${getX(i)},${getY(Number(d[dataKey]) || 0)}`);
  const pathD = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt}`;
    const [pX, pY] = arr[i - 1].split(',').map(Number);
    const [cX, cY] = pt.split(',').map(Number);
    const midX = (pX + cX) / 2;
    return `${acc} C ${midX},${pY} ${midX},${cY} ${cX},${cY}`;
  }, '');

  const areaD = `${pathD} L ${getX(data.length - 1)},${chartHeight - paddingY} L ${getX(0)},${chartHeight - paddingY} Z`;

  // Horizontal grid lines
  const gridSteps = 4;
  const gridLines = [];
  for (let i = 0; i <= gridSteps; i++) {
    const val = (maxVal / gridSteps) * i;
    const y = getY(val);
    gridLines.push({ val, y });
  }

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible"
        style={{ maxHeight: height }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillGradient[0]} />
            <stop offset="100%" stopColor={fillGradient[1]} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines & Y labels */}
        {gridLines.map((g, idx) => (
          <g key={idx}>
            <line
              x1={paddingX}
              y1={g.y}
              x2={chartWidth - paddingX}
              y2={g.y}
              stroke="#1e293b"
              strokeDasharray="4 4"
            />
            <text
              x={paddingX - 8}
              y={g.y + 4}
              fill="#64748b"
              fontSize="10"
              textAnchor="end"
              className="font-mono"
            >
              {valueFormatter(Math.round(g.val))}
            </text>
          </g>
        ))}

        {/* Filled Area */}
        <path d={areaD} fill="url(#areaGradient)" />

        {/* Smooth Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          filter="url(#glow)"
        />

        {/* Interactive Dots and hover trigger bars */}
        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(Number(d[dataKey]) || 0);
          const isHovered = hoverIndex === i;

          return (
            <g key={i}>
              {/* Invisible wide capture area */}
              <rect
                x={cx - 15}
                y={0}
                width={30}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />

              {isHovered && (
                <line
                  x1={cx}
                  y1={paddingY}
                  x2={cx}
                  y2={chartHeight - paddingY}
                  stroke={strokeColor}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              )}

              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 3.5}
                fill={isHovered ? strokeColor : '#0f172a'}
                stroke={strokeColor}
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all duration-150"
              />

              {/* X Axis Date Labels */}
              {(data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
                <text
                  x={cx}
                  y={chartHeight - 8}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {String(d[labelKey]).slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {activePoint && hoverIndex !== null && (
        <div
          className="absolute z-20 pointer-events-none p-2.5 rounded-lg bg-[#0b0f19] border border-[#49202C] shadow-xl backdrop-blur-md text-xs transition-transform duration-75"
          style={{
            left: `${(getX(hoverIndex) / chartWidth) * 100}%`,
            top: '15px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold text-slate-300 mb-1">{activePoint[labelKey]}</div>
          <div className="text-[#D7FF00] font-bold font-mono text-sm">
            {valueFormatter(activePoint[dataKey])}
          </div>
          {activePoint.transactions !== undefined && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              {activePoint.transactions} transaction{activePoint.transactions === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Interactive Horizontal or Vertical Bar Comparison Chart
 */
export const BarComparisonChart = ({
  data = [],
  labelKey = 'label',
  valueKey = 'value',
  sublabelKey = null,
  color = '#00E5FF',
  valuePrefix = '',
  valueSuffix = '',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-xs italic">
        No distribution records.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.round((val / maxVal) * 100);

        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 truncate max-w-[200px]">
                {item[labelKey]}
                {sublabelKey && item[sublabelKey] && (
                  <span className="ml-1.5 text-[11px] text-slate-500 font-normal">
                    ({item[sublabelKey]})
                  </span>
                )}
              </span>
              <span className="font-mono font-bold text-[#D7FF00]">
                {valuePrefix}
                {typeof val === 'number' && val % 1 !== 0 ? val.toFixed(1) : val.toLocaleString('en-IN')}
                {valueSuffix}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900 border border-slate-800/80 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  background:
                    item.color ||
                    `linear-gradient(90deg, ${color} 0%, rgba(0, 229, 255, 0.4) 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Donut / Segment Breakdown Component with interactive legend
 */
export const DonutBreakdownChart = ({
  segments = [],
  totalLabel = 'Total Net',
  centerValue = '₹0',
}) => {
  const total = segments.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {segments.map((seg, idx) => {
            const val = Number(seg.value) || 0;
            const pct = total > 0 ? val / total : 0;
            const strokeDash = pct * circumference;
            const offset = currentOffset;
            currentOffset -= strokeDash;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color || '#00E5FF'}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                strokeDashoffset={offset}
                className="transition-all duration-300 hover:opacity-90 cursor-pointer"
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          <span className="text-[10px] uppercase font-semibold text-slate-400">{totalLabel}</span>
          <span className="text-sm font-bold font-mono text-white mt-0.5">{centerValue}</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="space-y-2 flex-1 w-full max-w-xs">
        {segments.map((seg, idx) => {
          const val = Number(seg.value) || 0;
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;

          return (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color || '#00E5FF' }}
                />
                <span className="text-slate-300 font-medium">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-slate-400 text-[11px]">{pct}%</span>
                <span className="text-white font-semibold">
                  {seg.prefix || '₹'}
                  {val.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
