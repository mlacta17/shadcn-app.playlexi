#!/bin/bash
# Regenerate TTS sentence audio for words that had placeholder sentences

WORDS=(
  "accountant" "accoutrements" "anthropology" "antibody" "any" "appurtenance"
  "attorney" "axe" "bathysphere" "bibliophile" "blackberry" "blacksmith"
  "bougainvillea" "bracelet" "breakout" "camel" "camera" "candle" "cod" "comet"
  "cot" "crystallography" "deer" "dragon" "ecclesiastic" "electrocardiogram"
  "electromagnetic" "elk" "elm" "encephalopathy" "entrepreneurial" "extemporaneous"
  "extraordinaire" "fig" "frog" "furthermore" "geometry" "grandchildren" "gum"
  "hallucinogenic" "harbor" "helicopter" "hen" "him" "hippopotamus" "hydrogen"
  "kindergarten" "legerdemain" "lid" "locomotive" "oar" "ophthalmologist" "owl"
  "pillow" "platinum" "rainbow" "schadenfreude" "shark" "telegram" "thaumaturgist"
  "thoroughfare" "turtle" "vat" "verisimilar" "vicissitudes" "volleyball"
  "watermelon" "whale" "whimsicality" "worcestershire" "xanthophyll" "xylophonist"
  "yak" "yam"
)

echo "Regenerating TTS sentence audio for ${#WORDS[@]} words..."
echo "Estimated cost: ~\$0.12"
echo ""

for word in "${WORDS[@]}"; do
  echo "Processing: $word"
  npx ts-node scripts/generate-tts.ts --production --word="$word" --type=sentence 2>&1 | grep -E "(✓|✗|Error|Upload)"
  sleep 0.3  # Rate limit
done

echo ""
echo "Done!"
