import React, { memo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartDataPoint {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

interface CashFlowChartProps {
  data: ChartDataPoint[];
  isDark: boolean;
}

// Memoized chart component to prevent unnecessary re-renders
export const CashFlowChart = memo(({ data, isDark }: CashFlowChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f0f0f0'} />
        <XAxis 
          dataKey="date" 
          stroke={isDark ? '#9ca3af' : '#999'} 
          fontSize={12}
          tick={{ fill: isDark ? '#9ca3af' : '#999' }}
        />
        <YAxis 
          stroke={isDark ? '#9ca3af' : '#999'} 
          fontSize={12}
          tick={{ fill: isDark ? '#9ca3af' : '#999' }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: isDark ? '#374151' : 'white',
            border: isDark ? '1px solid #4b5563' : '1px solid #e5e5e5',
            borderRadius: '8px',
            fontSize: '12px',
            color: isDark ? '#f3f4f6' : '#111827'
          }}
          labelStyle={{
            color: isDark ? '#f3f4f6' : '#111827'
          }}
        />
        <Area 
          type="monotone" 
          dataKey="income" 
          stackId="1"
          stroke="#22c55e" 
          fill="url(#colorIncome)"
          isAnimationActive={false}
        />
        <Area 
          type="monotone" 
          dataKey="expenses" 
          stackId="2"
          stroke="#ef4444" 
          fill="url(#colorExpenses)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  // Only re-render if data actually changed
  if (prevProps.data.length !== nextProps.data.length) return false;
  if (prevProps.isDark !== nextProps.isDark) return false;
  
  // Check if data values are the same
  for (let i = 0; i < prevProps.data.length; i++) {
    const prev = prevProps.data[i];
    const next = nextProps.data[i];
    if (prev.date !== next.date || 
        prev.income !== next.income || 
        prev.expenses !== next.expenses) {
      return false;
    }
  }
  
  return true; // Props are equal, skip re-render
});

CashFlowChart.displayName = 'CashFlowChart';