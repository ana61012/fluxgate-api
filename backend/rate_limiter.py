import os
import time
import logging
import redis.asyncio as redis
from redis.exceptions import RedisError
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

LUA_SCRIPT = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local refill_interval = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
end

local time_passed = math.max(0, now - last_refill)
local refills = math.floor(time_passed / refill_interval)

if refills > 0 then
    tokens = math.min(capacity, tokens + (refills * refill_rate))
    last_refill = last_refill + (refills * refill_interval)
end

local allowed = 0
if tokens >= 1 then
    allowed = 1
    tokens = tokens - 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
-- Increased EXPIRE to 120s so the key doesn't die before a 60s refill triggers
redis.call('EXPIRE', key, 120)

return {allowed, tokens}
"""

async def check_rate_limit(api_key: str, limit: int):
    now = int(time.time())
    
    try:
        # FIX: Changed arguments to (limit, limit, 60, now)
        # This tells Redis: Refill `limit` (5) tokens every 60 seconds
        result = await redis_client.eval(
            LUA_SCRIPT, 1, f"rate_limit:{api_key}", 
            limit, limit, 60, now
        )
        allowed, remaining_tokens = result
        
        if not allowed:
            raise HTTPException(
                status_code=429, 
                detail="Rate limit exceeded. Please wait 1 minute."
            )
        return remaining_tokens
        
    except RedisError as e:
        # FAILURE MODE THINKING: FAIL OPEN
        # If Redis goes down, we log a critical error but allow the request to pass.
        # It is better to temporarily lose rate-limiting than to take down our customers' production apps.
        logging.critical(f"REDIS CONNECTION FAILED: {e}. Failing OPEN and allowing request.")
        return limit