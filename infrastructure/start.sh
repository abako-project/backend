#!/bin/bash
set -e

echo "Starting Zombienet..."
zombienet -p native spawn kreivo-rococo-local.toml > /tmp/zombienet.log 2>&1 &
ZOMBIENET_PID=$!

echo "Waiting for port 21000 to be available..."
for i in {1..120}; do
  if curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' http://localhost:21000 > /dev/null 2>&1; then
    echo "Port 21000 is ready!"
    break
  fi
  sleep 2
done

echo "Waiting for block #1 to be produced..."
for i in {1..180}; do
  BLOCK_HEX=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getHeader"}' http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "")
  
  if [ ! -z "$BLOCK_HEX" ] && [ "$BLOCK_HEX" != "null" ]; then
    BLOCK_NUM=$(printf "%d" $BLOCK_HEX 2>/dev/null || echo "0")
    echo "Current block: $BLOCK_NUM"
    
    if [ "$BLOCK_NUM" -ge 1 ]; then
      echo "Block #1 has been produced!"
      break
    fi
  fi
  sleep 2
done

echo "Executing subskribinto command for projects..."
subskribinto \
  --endpoint ws://localhost:21000 \
  --phrase "bottom drive obey lake curtain smoke basket hold race lonely fit walk" \
  --derive-path "//Alice" \
  --call-file /zombienet/contracts/projects_kreivo_local.dat

echo "Projects contract executed successfully!"

echo "Waiting for projects transaction to be finalized..."
# Get the block number where the transaction was included
PROJECTS_BLOCK_HEX=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getHeader"}' http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
PROJECTS_BLOCK_NUM=$(printf "%d" $PROJECTS_BLOCK_HEX 2>/dev/null || echo "0")

echo "Projects transaction included in block number: $PROJECTS_BLOCK_NUM"

# Wait for the block to be finalized
for i in {1..120}; do
  FINALIZED_HASH=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getFinalizedHead"}' http://localhost:21000 2>/dev/null | jq -r '.result' 2>/dev/null || echo "")
  
  if [ ! -z "$FINALIZED_HASH" ] && [ "$FINALIZED_HASH" != "null" ]; then
    # Get the finalized block number
    FINALIZED_BLOCK=$(curl -s -H "Content-Type: application/json" -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"chain_getHeader\", \"params\": [\"$FINALIZED_HASH\"]}" http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
    FINALIZED_BLOCK_NUM=$(printf "%d" $FINALIZED_BLOCK 2>/dev/null || echo "0")
    
    echo "Current finalized block: $FINALIZED_BLOCK_NUM, Projects block: $PROJECTS_BLOCK_NUM"
    
    if [ "$FINALIZED_BLOCK_NUM" -ge "$PROJECTS_BLOCK_NUM" ]; then
      echo "Projects transaction has been finalized at block $FINALIZED_BLOCK_NUM!"
      
      # Wait for at least 2 more blocks to be finalized after projects finalization
      TARGET_FINALIZED_BLOCK=$((FINALIZED_BLOCK_NUM + 2))
      
      for j in {1..60}; do
        CURRENT_FINALIZED_HASH=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getFinalizedHead"}' http://localhost:21000 2>/dev/null | jq -r '.result' 2>/dev/null || echo "")
        
        if [ ! -z "$CURRENT_FINALIZED_HASH" ] && [ "$CURRENT_FINALIZED_HASH" != "null" ]; then
          CURRENT_FINALIZED_BLOCK_HEX=$(curl -s -H "Content-Type: application/json" -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"chain_getHeader\", \"params\": [\"$CURRENT_FINALIZED_HASH\"]}" http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
          CURRENT_FINALIZED_BLOCK_NUM=$(printf "%d" $CURRENT_FINALIZED_BLOCK_HEX 2>/dev/null || echo "0")
          
          echo "Current finalized block: $CURRENT_FINALIZED_BLOCK_NUM, Waiting for finalized block >= $TARGET_FINALIZED_BLOCK"
          
          if [ "$CURRENT_FINALIZED_BLOCK_NUM" -ge "$TARGET_FINALIZED_BLOCK" ]; then
            echo "Ready to deploy calendar contract."
            break
          fi
        fi
        sleep 2
      done
      
      break
    fi
  fi
  sleep 2
done

echo "Executing subskribinto command for calendar..."
subskribinto \
  --endpoint ws://localhost:21000 \
  --phrase "bottom drive obey lake curtain smoke basket hold race lonely fit walk" \
  --derive-path "//Alice" \
  --call-file /zombienet/contracts/calendar_kreivo_local.dat

echo "Calendar contract executed successfully!"

echo "Waiting for calendar transaction to be finalized..."
# Get the block number where the calendar transaction was included
CALENDAR_BLOCK_HEX=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getHeader"}' http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
CALENDAR_BLOCK_NUM=$(printf "%d" $CALENDAR_BLOCK_HEX 2>/dev/null || echo "0")

echo "Calendar transaction included in block number: $CALENDAR_BLOCK_NUM"

# Wait for the calendar block to be finalized
for i in {1..120}; do
  FINALIZED_HASH=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getFinalizedHead"}' http://localhost:21000 2>/dev/null | jq -r '.result' 2>/dev/null || echo "")
  
  if [ ! -z "$FINALIZED_HASH" ] && [ "$FINALIZED_HASH" != "null" ]; then
    # Get the finalized block number
    FINALIZED_BLOCK=$(curl -s -H "Content-Type: application/json" -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"chain_getHeader\", \"params\": [\"$FINALIZED_HASH\"]}" http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
    FINALIZED_BLOCK_NUM=$(printf "%d" $FINALIZED_BLOCK 2>/dev/null || echo "0")
    
    echo "Current finalized block: $FINALIZED_BLOCK_NUM, Calendar block: $CALENDAR_BLOCK_NUM"
    
    if [ "$FINALIZED_BLOCK_NUM" -ge "$CALENDAR_BLOCK_NUM" ]; then
      echo "Calendar transaction has been finalized at block $FINALIZED_BLOCK_NUM!"
      
      # Wait for at least 2 more blocks to be finalized after calendar finalization
      TARGET_FINALIZED_BLOCK=$((FINALIZED_BLOCK_NUM + 2))
      
      for j in {1..60}; do
        CURRENT_FINALIZED_HASH=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getFinalizedHead"}' http://localhost:21000 2>/dev/null | jq -r '.result' 2>/dev/null || echo "")
        
        if [ ! -z "$CURRENT_FINALIZED_HASH" ] && [ "$CURRENT_FINALIZED_HASH" != "null" ]; then
          CURRENT_FINALIZED_BLOCK_HEX=$(curl -s -H "Content-Type: application/json" -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"chain_getHeader\", \"params\": [\"$CURRENT_FINALIZED_HASH\"]}" http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
          CURRENT_FINALIZED_BLOCK_NUM=$(printf "%d" $CURRENT_FINALIZED_BLOCK_HEX 2>/dev/null || echo "0")
          
          echo "Current finalized block: $CURRENT_FINALIZED_BLOCK_NUM, Waiting for finalized block >= $TARGET_FINALIZED_BLOCK"
          
          if [ "$CURRENT_FINALIZED_BLOCK_NUM" -ge "$TARGET_FINALIZED_BLOCK" ]; then
            echo "Ready to execute custom call."
            break
          fi
        fi
        sleep 2
      done
      
      break
    fi
  fi
  sleep 2
done

echo "Executing subskribinto command for ratings..."
subskribinto \
  --endpoint ws://localhost:21000 \
  --phrase "bottom drive obey lake curtain smoke basket hold race lonely fit walk" \
  --derive-path "//Alice" \
  --call-file /zombienet/contracts/ratings_kreivo_local.dat

echo "Ratings contract executed successfully!"

echo "Waiting for ratings transaction to be finalized..."
# Get the block number where the ratings transaction was included
RATINGS_BLOCK_HEX=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getHeader"}' http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
RATINGS_BLOCK_NUM=$(printf "%d" $RATINGS_BLOCK_HEX 2>/dev/null || echo "0")

echo "Ratings transaction included in block number: $RATINGS_BLOCK_NUM"

# Wait for the ratings block to be finalized
for i in {1..120}; do
  FINALIZED_HASH=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getFinalizedHead"}' http://localhost:21000 2>/dev/null | jq -r '.result' 2>/dev/null || echo "")
  
  if [ ! -z "$FINALIZED_HASH" ] && [ "$FINALIZED_HASH" != "null" ]; then
    # Get the finalized block number
    FINALIZED_BLOCK=$(curl -s -H "Content-Type: application/json" -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"chain_getHeader\", \"params\": [\"$FINALIZED_HASH\"]}" http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
    FINALIZED_BLOCK_NUM=$(printf "%d" $FINALIZED_BLOCK 2>/dev/null || echo "0")
    
    echo "Current finalized block: $FINALIZED_BLOCK_NUM, Ratings block: $RATINGS_BLOCK_NUM"
    
    if [ "$FINALIZED_BLOCK_NUM" -ge "$RATINGS_BLOCK_NUM" ]; then
      echo "Ratings transaction has been finalized at block $FINALIZED_BLOCK_NUM!"
      
      # Wait for at least 2 more blocks to be finalized after ratings finalization
      TARGET_FINALIZED_BLOCK=$((FINALIZED_BLOCK_NUM + 2))
      
      for j in {1..60}; do
        CURRENT_FINALIZED_HASH=$(curl -s -H "Content-Type: application/json" -d '{"id":1, "jsonrpc":"2.0", "method": "chain_getFinalizedHead"}' http://localhost:21000 2>/dev/null | jq -r '.result' 2>/dev/null || echo "")
        
        if [ ! -z "$CURRENT_FINALIZED_HASH" ] && [ "$CURRENT_FINALIZED_HASH" != "null" ]; then
          CURRENT_FINALIZED_BLOCK_HEX=$(curl -s -H "Content-Type: application/json" -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"chain_getHeader\", \"params\": [\"$CURRENT_FINALIZED_HASH\"]}" http://localhost:21000 2>/dev/null | jq -r '.result.number' 2>/dev/null || echo "0x0")
          CURRENT_FINALIZED_BLOCK_NUM=$(printf "%d" $CURRENT_FINALIZED_BLOCK_HEX 2>/dev/null || echo "0")
          
          echo "Current finalized block: $CURRENT_FINALIZED_BLOCK_NUM, Waiting for finalized block >= $TARGET_FINALIZED_BLOCK"
          
          if [ "$CURRENT_FINALIZED_BLOCK_NUM" -ge "$TARGET_FINALIZED_BLOCK" ]; then
            echo "Ready to execute custom call."
            break
          fi
        fi
        sleep 2
      done
      
      break
    fi
  fi
  sleep 2
done

echo "Executing custom call..."
subskribinto \
  --endpoint ws://localhost:21000 \
  --phrase "bottom drive obey lake curtain smoke basket hold race lonely fit walk" \
  --derive-path "//Alice" \
  --call 0x2b00dc2b00084a2000000000000000e40b540200000000000000000000004a0600000000000001042b00084a2000000100000000e40b540200000000000000000000004a0600000100000001042b00084a2000000200000000e40b540200000000000000000000004a0600000200000001042b00084a2000000300000000e40b540200000000000000000000004a0600000300000001042b00084a2000000400000000e40b540200000000000000000000004a0600000400000001042b00084a2000000500000000e40b540200000000000000000000004a0600000500000001042b00084a2000000600000000e40b540200000000000000000000004a0600000600000001042b00084a2000000700000000e40b540200000000000000000000004a0600000700000001042b00084a2000000800000000e40b540200000000000000000000004a0600000800000001042b00084a2000000900000000e40b540200000000000000000000004a0600000900000001042b00084a2000000a00000000e40b540200000000000000000000004a0600000a00000001042b00084a2000000b00000000e40b540200000000000000000000004a0600000b00000001042b00084a2000000c00000000e40b540200000000000000000000004a0600000c00000001042b00084a2000000d00000000e40b540200000000000000000000004a0600000d00000001042b00084a2000000e00000000e40b540200000000000000000000004a0600000e00000001042b00084a2000000f00000000e40b540200000000000000000000004a0600000f00000001042b00084a2000001000000000e40b540200000000000000000000004a0600001000000001042b00084a2000001100000000e40b540200000000000000000000004a0600001100000001042b00084a2000001200000000e40b540200000000000000000000004a0600001200000001042b00084a2000001300000000e40b540200000000000000000000004a0600001300000001042b00084a2000001400000000e40b540200000000000000000000004a0600001400000001042b00084a2000001500000000e40b540200000000000000000000004a0600001500000001042b00084a2000001600000000e40b540200000000000000000000004a0600001600000001042b00084a2000001700000000e40b540200000000000000000000004a0600001700000001042b00084a2000001800000000e40b540200000000000000000000004a0600001800000001042b00084a2000001900000000e40b540200000000000000000000004a0600001900000001042b00084a2000001a00000000e40b540200000000000000000000004a0600001a00000001042b00084a2000001b00000000e40b540200000000000000000000004a0600001b00000001042b00084a2000001c00000000e40b540200000000000000000000004a0600001c00000001042b00084a2000001d00000000e40b540200000000000000000000004a0600001d00000001042b00084a2000001e00000000e40b540200000000000000000000004a0600001e00000001042b00084a2000001f00000000e40b540200000000000000000000004a0600001f00000001042b00084a2000002000000000e40b540200000000000000000000004a0600002000000001042b00084a2000002100000000e40b540200000000000000000000004a0600002100000001042b00084a2000002200000000e40b540200000000000000000000004a0600002200000001042b00084a2000002300000000e40b540200000000000000000000004a0600002300000001042b00084a2000002400000000e40b540200000000000000000000004a0600002400000001042b00084a2000002500000000e40b540200000000000000000000004a0600002500000001042b00084a2000002600000000e40b540200000000000000000000004a0600002600000001042b00084a2000002700000000e40b540200000000000000000000004a0600002700000001042b00084a2000002800000000e40b540200000000000000000000004a0600002800000001042b00084a2000002900000000e40b540200000000000000000000004a0600002900000001042b00084a2000002a00000000e40b540200000000000000000000004a0600002a00000001042b00084a2000002b00000000e40b540200000000000000000000004a0600002b00000001042b00084a2000002c00000000e40b540200000000000000000000004a0600002c00000001042b00084a2000002d00000000e40b540200000000000000000000004a0600002d00000001042b00084a2000002e00000000e40b540200000000000000000000004a0600002e00000001042b00084a2000002f00000000e40b540200000000000000000000004a0600002f00000001042b00084a2000003000000000e40b540200000000000000000000004a0600003000000001042b00084a2000003100000000e40b540200000000000000000000004a0600003100000001042b00084a2000003200000000e40b540200000000000000000000004a0600003200000001042b00084a2000003300000000e40b540200000000000000000000004a0600003300000001042b00084a2000003400000000e40b540200000000000000000000004a0600003400000001042b00084a2000003500000000e40b540200000000000000000000004a0600003500000001042b00084a2000003600000000e40b540200000000000000000000004a060000360000000104

echo "Custom call executed successfully!"
echo "All contracts deployed. Zombienet is still running. Logs available at /tmp/zombienet.log"

tail -f /tmp/zombienet.log


