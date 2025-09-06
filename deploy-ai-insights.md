# AI Spending Insights Deployment Guide

## Prerequisites

1. **Anthropic API Key**: Get your API key from https://console.anthropic.com/
2. **Supabase CLI**: Install via `npm install -g supabase`
3. **Supabase Project**: Your Clear Piggy project should be set up

## Step 1: Set Environment Variables

Set the required environment variables for the edge function:

```bash
# Set Anthropic API key (required for AI analysis)
npx supabase secrets set ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Verify environment variables are set
npx supabase secrets list
```

## Step 2: Deploy the Edge Function

```bash
# Deploy the AI insights function
npx supabase functions deploy ai-spending-insights

# Check deployment status
npx supabase functions list
```

## Step 3: Test the Function

Test the function with a sample workspace ID:

```bash
# Replace with your actual workspace ID
curl -X POST 'https://your-project.supabase.co/functions/v1/ai-spending-insights' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"workspace_id": "your-workspace-id"}'
```

## Step 4: Validate Data Quality

Before using AI insights, validate your data quality:

```bash
# Run data validation script
node validate-ai-data.js your-workspace-id
```

## Expected Response Format

The AI insights function returns:

```json
{
  "insights": [
    {
      "type": "opportunity",
      "title": "Coffee spending pattern detected",
      "description": "You spent $127 on coffee this month, 23% higher than last month",
      "category": "FOOD_AND_DRINK", 
      "amount_cents": 12700,
      "confidence": 0.85,
      "actionable": true,
      "recommendation": "Consider making coffee at home 2 days per week to save ~$45/month"
    }
  ],
  "budget_suggestions": [
    {
      "category": "FOOD_AND_DRINK",
      "suggested_monthly_limit_cents": 40000,
      "current_monthly_average_cents": 50000,
      "confidence": 0.8,
      "reasoning": "Based on 90-day analysis, 20% reduction is achievable"
    }
  ],
  "spending_summary": {
    "total_outflow_cents": 234500,
    "total_inflow_cents": 450000,
    "net_cashflow_cents": 215500,
    "top_category": "FOOD_AND_DRINK",
    "top_merchant": "Amazon",
    "transaction_count": 127,
    "unique_merchants": 45,
    "avg_transaction_cents": 1850
  },
  "alerts": [
    {
      "type": "high_spend",
      "message": "Unusual $500 charge at Best Buy detected",
      "severity": "medium"
    }
  ],
  "metadata": {
    "workspace_id": "123e4567-e89b-12d3-a456-426614174000",
    "generated_at": "2024-09-05T10:30:00Z",
    "transaction_count": 127,
    "data_hash": "abc123def456",
    "cached": false
  }
}
```

## Performance Features

1. **Caching**: Results cached for 4 hours to reduce API costs
2. **Data Hash**: Detects when transaction data changes
3. **Force Refresh**: Use `force_refresh: true` to bypass cache
4. **Rate Limiting**: Built-in throttling for Anthropic API calls

## Monitoring

Monitor the function performance:

```bash
# View function logs
npx supabase functions logs ai-spending-insights

# Monitor with follow mode
npx supabase functions logs ai-spending-insights --follow
```

## Troubleshooting

### Common Issues

1. **Anthropic API Key Missing**
   ```
   Error: Anthropic API key not configured
   ```
   Solution: Set the `ANTHROPIC_API_KEY` secret

2. **Insufficient Data**
   ```json
   {
     "insights": [{
       "type": "warning",
       "title": "Insufficient Data",
       "description": "Need at least 10 transactions for meaningful AI analysis"
     }]
   }
   ```
   Solution: Sync more accounts or wait for more transactions

3. **Cache Issues**
   - Use `force_refresh: true` to bypass cache
   - Cache automatically expires after 4 hours

### Data Quality Requirements

For best AI insights:
- **Minimum**: 30+ transactions
- **Optimal**: 90+ days of data
- **Categories**: 80%+ transactions categorized
- **Merchants**: 70%+ transactions with merchant names

## Cost Management

Anthropic API costs:
- Claude-3-Haiku: ~$0.0015 per insight generation
- Caching reduces costs by ~80% after initial analysis
- Typical cost: $0.10-$0.30 per user per month

## Next Steps

1. Monitor function logs for errors
2. Validate data quality regularly
3. Adjust cache duration based on usage
4. Consider implementing user feedback for insight accuracy