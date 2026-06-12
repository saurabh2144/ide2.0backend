# AI Provider Configuration Guide

## 🤖 Supported AI Providers

### 1. **Groq (Recommended - FREE & UNLIMITED)** ⚡

**Best Choice**: Fast, reliable, and truly free!

- **Cost**: 100% FREE
- **Speed**: Fastest inference (up to 500 tokens/sec)
- **Limits**: 14,400 requests/day (more than enough)
- **Expiry**: API keys never expire
- **Models**: Llama 3.3 70B, Llama 3.1, Mixtral, Gemma

**Setup:**
1. Go to https://console.groq.com/
2. Sign up (free)
3. Create API key
4. Add to `.env`:
   ```
   AI_PROVIDER=groq
   GROQ_API_KEY=gsk_your_actual_groq_key_here
   ```

---

### 2. **DeepSeek (Current Setup - 7 Days Expiry)** 🔄

Via HuggingFace Router

- **Cost**: FREE
- **Speed**: Moderate
- **Limits**: Good for testing
- **Expiry**: Tokens expire every 7 days
- **Models**: DeepSeek V4 Pro

**Setup:**
1. Go to https://huggingface.co/settings/tokens
2. Create access token
3. Add to `.env`:
   ```
   AI_PROVIDER=deepseek
   HF_TOKEN=hf_your_actual_token_here
   ```

---

### 3. **Google Gemini (FREE)** 🌟

- **Cost**: FREE with generous limits
- **Speed**: Fast
- **Limits**: 60 requests/minute
- **Expiry**: API keys don't expire
- **Models**: Gemini 1.5 Flash, Gemini 1.5 Pro

**Setup:**
1. Go to https://aistudio.google.com/
2. Get API key
3. Add to `.env`:
   ```
   AI_PROVIDER=gemini
   GOOGLE_API_KEY=your_google_api_key_here
   ```

---

### 4. **OpenAI (Paid - Best Quality)** 💰

- **Cost**: Pay per use (~$0.15/1M tokens for GPT-4o-mini)
- **Speed**: Fast
- **Limits**: Based on tier
- **Quality**: Highest
- **Models**: GPT-4o, GPT-4o-mini, GPT-4 Turbo

**Setup:**
1. Go to https://platform.openai.com/
2. Add credits
3. Create API key
4. Add to `.env`:
   ```
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-your_actual_openai_key
   ```

---

## 🔄 How to Switch Providers

1. Open `backend/.env`
2. Change `AI_PROVIDER` to one of: `groq`, `deepseek`, `gemini`, `openai`
3. Add the corresponding API key
4. Restart server: `npm start`

**Example:**
```env
# Switch to Groq
AI_PROVIDER=groq
GROQ_API_KEY=gsk_abc123...

# Or switch to Gemini
AI_PROVIDER=gemini
GOOGLE_API_KEY=AIza...
```

---

## 📊 Comparison Table

| Provider | Cost | Speed | Limits | Expiry | Quality |
|----------|------|-------|--------|--------|---------|
| **Groq** | FREE | ⚡⚡⚡ | 14.4k/day | Never | ⭐⭐⭐⭐ |
| DeepSeek | FREE | ⚡⚡ | Good | 7 days | ⭐⭐⭐⭐ |
| Gemini | FREE | ⚡⚡⚡ | 60/min | Never | ⭐⭐⭐⭐ |
| OpenAI | Paid | ⚡⚡⚡ | Tier-based | Never | ⭐⭐⭐⭐⭐ |

---

## 🎯 Recommendation

**Use Groq** for production because:
- ✅ Completely free
- ✅ No expiry issues
- ✅ Very fast
- ✅ Excellent quality
- ✅ High daily limits

---

## 🔧 Troubleshooting

### API Key Not Working?
- Check if API key is correctly copied
- Verify the provider name is correct: `groq`, `deepseek`, `gemini`, or `openai`
- Restart the server after changing `.env`

### Rate Limit Errors?
- Switch to a different provider
- Groq has the highest free limits (14,400/day)

### Token Expired?
- DeepSeek tokens expire every 7 days
- **Solution**: Switch to Groq or Gemini (never expire)

---

## 📝 Environment Variables Template

```env
PORT=5000
BASE_URL=https://myidebackend.onrender.com

# Choose your provider (groq recommended)
AI_PROVIDER=groq

# Groq (Recommended - FREE & UNLIMITED)
GROQ_API_KEY=gsk_your_groq_key_here

# DeepSeek (FREE - 7 days expiry)
HF_TOKEN=hf_your_token_here

# Google Gemini (FREE - No expiry)
GOOGLE_API_KEY=AIza_your_key_here

# OpenAI (Paid - Best quality)
OPENAI_API_KEY=sk_your_key_here

# Netlify
NETLIFY_API_TOKEN=nfp_your_netlify_token_here
```
