SERVICE "bonecrusher-router";

ROUTER "esp32-rr" INPUT "esp32.shared.inbound"
  DISCOVERY "role=esp32,service=bonecrusher"
  SCHEDULE "worker.pick"
  POLICY "round_robin"
BEGIN
  OUTPUT "esp32.shared.drained" WHEN "output := 1;" TRANSFORM "output := src;";
END;

ROUTER "esp32-lru" INPUT "esp32.shared.inbound"
  DISCOVERY "role=esp32,service=bonecrusher"
  SCHEDULE "worker.pick"
  POLICY "least_recently_used"
BEGIN
  OUTPUT "esp32.shared.drained" WHEN "output := 1;" TRANSFORM "output := src;";
END;
