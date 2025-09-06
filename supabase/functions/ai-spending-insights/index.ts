import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCachedInsights, setCachedInsights, generateDataHash } from './cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TransactionData {
  id: string
  workspace_id: string
  transaction_date: string
  amount_cents: number
  direction: 'inflow' | 'outflow'
  merchant_name?: string
  merchant_normalized?: string
  personal_finance_category_primary?: string
  personal_finance_category_detailed?: string
  location_city?: string
  location_region?: string
  payment_method?: string
  description?: string
  bank_account_id: string
  account_name?: string
  merchant_logo_url?: string
}

const AI_ANALYSIS_PROMPT = `
You are a financial analyst for Clear Piggy, a personal finance app. Analyze this user's transaction data and provide actionable insights.

TRANSACTION DATA:
{TRANSACTION_DATA}

SCHEMA CONTEXT:
- amount_cents: Transaction amount in cents (divide by 100 for dollars)
- direction: 'inflow' (income/credits) or 'outflow' (expenses/debits)  
- personal_finance_category_primary: Plaid's standardized categories
- merchant_name: Raw merchant name from bank
- merchant_normalized: Cleaned merchant name
- location_city/region: Geographic data when available
- transaction_date: YYYY-MM-DD format

ANALYSIS REQUIREMENTS:

1. SPENDING PATTERNS
   - Compare current period vs previous periods
   - Identify category concentration (>30% in one category = flag)
   - Detect merchant frequency patterns
   - Note geographic spending patterns

2. BUDGET INSIGHTS  
   - Suggest monthly budget allocations by category
   - Flag categories that need attention
   - Identify potential savings opportunities
   - Compare inflow vs outflow trends

3. BEHAVIORAL ANALYSIS
   - Payment method preferences
   - Weekend vs weekday spending
   - Recurring transaction detection
   - Unusual merchant activity

4. ACTIONABLE RECOMMENDATIONS
   - Specific dollar amounts for budget adjustments
   - Merchant consolidation opportunities  
   - Category optimization suggestions
   - Cash flow timing improvements

RESPONSE FORMAT (JSON only, no additional text):
{
  "insights": [
    {
      "type": "pattern|anomaly|opportunity|warning",
      "title": "Concise insight title",
      "description": "Detailed explanation with specific data",
      "category": "personal_finance_category_primary affected",
      "amount_cents": 0,
      "confidence": 0.0,
      "actionable": true,
      "recommendation": "Specific action to take"
    }
  ],
  "budget_suggestions": [
    {
      "category": "FOOD_AND_DRINK", 
      "suggested_monthly_limit_cents": 50000,
      "current_monthly_average_cents": 65000,
      "confidence": 0.8,
      "reasoning": "Based on analysis with specific recommendations"
    }
  ],
  "spending_summary": {
    "total_outflow_cents": 0,
    "total_inflow_cents": 0,
    "net_cashflow_cents": 0,
    "top_category": "FOOD_AND_DRINK",
    "top_merchant": "Amazon",
    "transaction_count": 0,
    "unique_merchants": 0,
    "avg_transaction_cents": 0
  },
  "alerts": [
    {
      "type": "high_spend|unusual_merchant|location_anomaly|budget_exceeded",
      "message": "Specific alert message",
      "severity": "low|medium|high"
    }
  ]
}

Focus on practical, actionable insights that help users optimize their finances.
`

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request data
    const { workspace_id, force_refresh = false } = await req.json()
    
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check cache first (unless force refresh is requested)
    if (!force_refresh) {
      const cachedResult = getCachedInsights(workspace_id);
      if (cachedResult) {
        console.log('Returning cached insights for workspace:', workspace_id);
        return new Response(
          JSON.stringify({ ...cachedResult, cached: true }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-Cache-Hit': 'true',
              'Cache-Control': 'public, max-age=3600' 
            } 
          }
        );
      }
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get transactions from last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const { data: transactions, error: transactionError } = await supabase
      .from('feed_transactions')
      .select(`
        id,
        workspace_id,
        transaction_date,
        amount_cents,
        direction,
        merchant_name,
        merchant_normalized,
        personal_finance_category_primary,
        personal_finance_category_detailed,
        location_city,
        location_region,
        payment_method,
        description,
        bank_account_id,
        account_name,
        merchant_logo_url
      `)
      .eq('workspace_id', workspace_id)
      .gte('transaction_date', ninetyDaysAgo)
      .order('transaction_date', { ascending: false })

    if (transactionError) {
      console.error('Transaction fetch error:', transactionError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!transactions || transactions.length < 10) {
      // Not enough data for meaningful analysis
      return new Response(
        JSON.stringify({
          insights: [{
            type: 'warning',
            title: 'Insufficient Data',
            description: 'Need at least 10 transactions for meaningful AI analysis',
            category: 'GENERAL',
            amount_cents: 0,
            confidence: 1.0,
            actionable: false,
            recommendation: 'Connect more accounts or wait for more transactions to sync'
          }],
          budget_suggestions: [],
          spending_summary: {
            total_outflow_cents: 0,
            total_inflow_cents: 0,
            net_cashflow_cents: 0,
            top_category: 'N/A',
            top_merchant: 'N/A',
            transaction_count: transactions?.length || 0,
            unique_merchants: 0,
            avg_transaction_cents: 0
          },
          alerts: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Claude API for analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const prompt = AI_ANALYSIS_PROMPT.replace('{TRANSACTION_DATA}', JSON.stringify(transactions, null, 2))

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error('Anthropic API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to analyze transactions with AI' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const anthropicData = await anthropicResponse.json()
    const aiAnalysis = anthropicData.content[0].text

    // Parse AI response
    let analysisResult
    try {
      analysisResult = JSON.parse(aiAnalysis)
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiAnalysis)
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Add metadata
    analysisResult.metadata = {
      workspace_id,
      generated_at: new Date().toISOString(),
      transaction_count: transactions.length,
      data_hash: generateDataHash(transactions),
      cached: false
    };

    // Cache the result
    setCachedInsights(workspace_id, analysisResult);

    return new Response(
      JSON.stringify(analysisResult),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache-Hit': 'false',
          'Cache-Control': 'public, max-age=3600'
        } 
      }
    )

  } catch (error) {
    console.error('Error in ai-spending-insights function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})